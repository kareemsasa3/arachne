package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestHandleHealth(t *testing.T) {
	// Create a mock request to pass to our handler
	req, err := http.NewRequest("GET", "/health", nil)
	if err != nil {
		t.Fatal(err)
	}

	// We use httptest.NewRecorder to record the response
	rr := httptest.NewRecorder()
	storage := NewInMemoryStorage()
	handler := http.HandlerFunc(NewAPIHandler(nil, DefaultConfig(), storage).HandleHealth)

	// Our handlers satisfy http.Handler, so we can call their ServeHTTP method
	// directly and pass in our Request and ResponseRecorder
	handler.ServeHTTP(rr, req)

	// Check the status code is what we expect
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v",
			status, http.StatusOK)
	}

	// Check the response body is what we expect
	expected := `"status":"healthy"`
	if !strings.Contains(rr.Body.String(), expected) {
		t.Errorf("handler returned unexpected body: got %s want it to contain %s",
			rr.Body.String(), expected)
	}

	// Check Content-Type header
	if contentType := rr.Header().Get("Content-Type"); contentType != "application/json" {
		t.Errorf("handler returned wrong content type: got %v want %v",
			contentType, "application/json")
	}
}

func TestHandleScrape(t *testing.T) {
	storage := NewInMemoryStorage()
	handler := NewAPIHandler(nil, DefaultConfig(), storage)

	tests := []struct {
		name           string
		method         string
		body           string
		expectedStatus int
		expectedFields []string
	}{
		{
			name:           "Valid scrape request with URLs",
			method:         "POST",
			body:           `{"urls": ["https://example.com", "https://test.com"]}`,
			expectedStatus: http.StatusAccepted,
			expectedFields: []string{"job_id", "status", "message"},
		},
		{
			name:           "Valid scrape request with site URL",
			method:         "POST",
			body:           `{"site_url": "https://example.com"}`,
			expectedStatus: http.StatusAccepted,
			expectedFields: []string{"job_id", "status", "message"},
		},
		{
			name:           "Invalid method",
			method:         "GET",
			body:           `{"urls": ["https://example.com"]}`,
			expectedStatus: http.StatusMethodNotAllowed,
			expectedFields: []string{},
		},
		{
			name:           "Invalid JSON",
			method:         "POST",
			body:           `{"urls": ["https://example.com"`,
			expectedStatus: http.StatusBadRequest,
			expectedFields: []string{},
		},
		{
			name:           "No URLs provided",
			method:         "POST",
			body:           `{}`,
			expectedStatus: http.StatusBadRequest,
			expectedFields: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := http.NewRequest(tt.method, "/scrape", bytes.NewBufferString(tt.body))
			if err != nil {
				t.Fatal(err)
			}

			rr := httptest.NewRecorder()
			handlerFunc := http.HandlerFunc(handler.HandleScrape)
			handlerFunc.ServeHTTP(rr, req)

			if status := rr.Code; status != tt.expectedStatus {
				t.Errorf("handler returned wrong status code: got %v want %v",
					status, tt.expectedStatus)
			}

			if tt.expectedStatus == http.StatusAccepted {
				// Check that response contains expected fields
				responseBody := rr.Body.String()
				for _, field := range tt.expectedFields {
					if !strings.Contains(responseBody, field) {
						t.Errorf("response body does not contain expected field %s: %s",
							field, responseBody)
					}
				}

				// Verify job was created in storage
				var response ScrapeResponse
				if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
					t.Fatalf("failed to unmarshal response: %v", err)
				}

				// Check that job exists in storage
				job, err := storage.GetJob(context.Background(), response.JobID)
				if err != nil {
					t.Errorf("job not found in storage: %v", err)
				}

				if job.Status != "pending" {
					t.Errorf("expected job status 'pending', got %s", job.Status)
				}
			}
		})
	}
}

func TestHandleJobStatus(t *testing.T) {
	storage := NewInMemoryStorage()
	handler := NewAPIHandler(nil, DefaultConfig(), storage)

	// Create a test job
	testJob := &ScrapingJob{
		ID:        "test-job-123",
		Status:    "completed",
		CreatedAt: time.Now(),
		Progress:  100,
	}
	storage.SaveJob(context.Background(), testJob)

	tests := []struct {
		name           string
		method         string
		jobID          string
		expectedStatus int
		expectedFields []string
	}{
		{
			name:           "Valid job status request",
			method:         "GET",
			jobID:          "test-job-123",
			expectedStatus: http.StatusOK,
			expectedFields: []string{"job", "id", "status", "progress"},
		},
		{
			name:           "Invalid method",
			method:         "POST",
			jobID:          "test-job-123",
			expectedStatus: http.StatusMethodNotAllowed,
			expectedFields: []string{},
		},
		{
			name:           "Missing job ID",
			method:         "GET",
			jobID:          "",
			expectedStatus: http.StatusBadRequest,
			expectedFields: []string{},
		},
		{
			name:           "Non-existent job",
			method:         "GET",
			jobID:          "non-existent-job",
			expectedStatus: http.StatusNotFound,
			expectedFields: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url := "/job/status"
			if tt.jobID != "" {
				url += "?id=" + tt.jobID
			}

			req, err := http.NewRequest(tt.method, url, nil)
			if err != nil {
				t.Fatal(err)
			}

			rr := httptest.NewRecorder()
			handlerFunc := http.HandlerFunc(handler.HandleJobStatus)
			handlerFunc.ServeHTTP(rr, req)

			if status := rr.Code; status != tt.expectedStatus {
				t.Errorf("handler returned wrong status code: got %v want %v",
					status, tt.expectedStatus)
			}

			if tt.expectedStatus == http.StatusOK {
				// Check that response contains expected fields
				responseBody := rr.Body.String()
				for _, field := range tt.expectedFields {
					if !strings.Contains(responseBody, field) {
						t.Errorf("response body does not contain expected field %s: %s",
							field, responseBody)
					}
				}

				// Verify job data in response
				var response JobStatusResponse
				if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
					t.Fatalf("failed to unmarshal response: %v", err)
				}

				if response.Job.ID != tt.jobID {
					t.Errorf("expected job ID %s, got %s", tt.jobID, response.Job.ID)
				}
			}
		})
	}
}

func TestHandleMetrics(t *testing.T) {
	config := DefaultConfig()
	config.EnableMetrics = true
	storage := NewInMemoryStorage()
	handler := NewAPIHandler(nil, config, storage)

	// Test with metrics enabled
	t.Run("Metrics enabled", func(t *testing.T) {
		req, err := http.NewRequest("GET", "/metrics", nil)
		if err != nil {
			t.Fatal(err)
		}

		rr := httptest.NewRecorder()
		handlerFunc := http.HandlerFunc(handler.HandleMetrics)
		handlerFunc.ServeHTTP(rr, req)

		if status := rr.Code; status != http.StatusOK {
			t.Errorf("handler returned wrong status code: got %v want %v",
				status, http.StatusOK)
		}

		if contentType := rr.Header().Get("Content-Type"); contentType != "application/json" {
			t.Errorf("handler returned wrong content type: got %v want %v",
				contentType, "application/json")
		}
	})

	// Test with metrics disabled
	t.Run("Metrics disabled", func(t *testing.T) {
		config.EnableMetrics = false
		handler := NewAPIHandler(nil, config, storage)

		req, err := http.NewRequest("GET", "/metrics", nil)
		if err != nil {
			t.Fatal(err)
		}

		rr := httptest.NewRecorder()
		handlerFunc := http.HandlerFunc(handler.HandleMetrics)
		handlerFunc.ServeHTTP(rr, req)

		if status := rr.Code; status != http.StatusServiceUnavailable {
			t.Errorf("handler returned wrong status code: got %v want %v",
				status, http.StatusServiceUnavailable)
		}
	})
}

func TestStorageInterface(t *testing.T) {
	storage := NewInMemoryStorage()
	ctx := context.Background()

	// Test job creation and retrieval
	t.Run("Save and Get Job", func(t *testing.T) {
		job := &ScrapingJob{
			ID:        "test-job",
			Status:    "pending",
			CreatedAt: time.Now(),
		}

		// Save job
		err := storage.SaveJob(ctx, job)
		if err != nil {
			t.Fatalf("failed to save job: %v", err)
		}

		// Retrieve job
		retrievedJob, err := storage.GetJob(ctx, job.ID)
		if err != nil {
			t.Fatalf("failed to get job: %v", err)
		}

		if retrievedJob.ID != job.ID {
			t.Errorf("expected job ID %s, got %s", job.ID, retrievedJob.ID)
		}

		if retrievedJob.Status != job.Status {
			t.Errorf("expected job status %s, got %s", job.Status, retrievedJob.Status)
		}
	})

	// Test job update
	t.Run("Update Job", func(t *testing.T) {
		job := &ScrapingJob{
			ID:        "update-test-job",
			Status:    "pending",
			CreatedAt: time.Now(),
		}

		// Save initial job
		err := storage.SaveJob(ctx, job)
		if err != nil {
			t.Fatalf("failed to save job: %v", err)
		}

		// Update job
		job.Status = "completed"
		err = storage.UpdateJob(ctx, job)
		if err != nil {
			t.Fatalf("failed to update job: %v", err)
		}

		// Verify update
		retrievedJob, err := storage.GetJob(ctx, job.ID)
		if err != nil {
			t.Fatalf("failed to get updated job: %v", err)
		}

		if retrievedJob.Status != "completed" {
			t.Errorf("expected updated job status 'completed', got %s", retrievedJob.Status)
		}
	})

	// Test job listing
	t.Run("List Jobs", func(t *testing.T) {
		jobIDs, err := storage.ListJobs(ctx)
		if err != nil {
			t.Fatalf("failed to list jobs: %v", err)
		}

		// Should have at least the jobs we created in previous tests
		if len(jobIDs) < 2 {
			t.Errorf("expected at least 2 jobs, got %d", len(jobIDs))
		}
	})

	// Test job deletion
	t.Run("Delete Job", func(t *testing.T) {
		job := &ScrapingJob{
			ID:        "delete-test-job",
			Status:    "pending",
			CreatedAt: time.Now(),
		}

		// Save job
		err := storage.SaveJob(ctx, job)
		if err != nil {
			t.Fatalf("failed to save job: %v", err)
		}

		// Delete job
		err = storage.DeleteJob(ctx, job.ID)
		if err != nil {
			t.Fatalf("failed to delete job: %v", err)
		}

		// Verify deletion
		_, err = storage.GetJob(ctx, job.ID)
		if err == nil {
			t.Error("expected error when getting deleted job, got nil")
		}
	})
}
