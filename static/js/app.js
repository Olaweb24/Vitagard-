// Global application state and utilities
const App = {
    // API base URL
    apiUrl: '/api',
    
    // Current user data
    user: null,
    
    // Loading state
    isLoading: false,
    
    // Initialize application
    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
        this.setupAjaxDefaults();
        this.initTheme();
        this.initMobileFeatures();
    },
    
    // Setup global event listeners
    setupEventListeners() {
        // Handle navigation
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-action]')) {
                e.preventDefault();
                this.handleAction(e.target.dataset.action, e.target);
            }
        });
        
        // Handle form submissions
        document.addEventListener('submit', (e) => {
            if (e.target.matches('form[data-api]')) {
                e.preventDefault();
                this.handleFormSubmit(e.target);
            }
        });
        
        // Handle logout
        document.addEventListener('click', (e) => {
            if (e.target.matches('.logout-btn')) {
                e.preventDefault();
                this.logout();
            }
        });
    },
    
    // Setup AJAX defaults
    setupAjaxDefaults() {
        // Add CSRF token to all requests if available
        const csrfToken = document.querySelector('meta[name="csrf-token"]');
        if (csrfToken) {
            this.csrfToken = csrfToken.content;
        }
    },
    
    // Check authentication status
    async checkAuthStatus() {
        try {
            const response = await this.api('/profile');
            if (response.ok) {
                const data = await response.json();
                this.user = data.user;
            }
        } catch (error) {
            console.log('Not authenticated');
        }
    },
    
    // Handle button actions
    async handleAction(action, element) {
        switch (action) {
            case 'refresh-tips':
                await this.refreshHealthTips();
                break;
            case 'refresh-weather':
                await this.refreshWeather();
                break;
            case 'refresh-alerts':
                await this.refreshAlerts();
                break;
            case 'quick-log':
                this.showQuickLogModal();
                break;
            default:
                console.warn('Unknown action:', action);
        }
    },
    
    // Handle form submissions
    async handleFormSubmit(form) {
        const apiEndpoint = form.dataset.api;
        const method = form.dataset.method || 'POST';
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        this.showLoading();
        
        try {
            const response = await this.api(apiEndpoint, {
                method: method,
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showSuccess(result.message || 'Operation successful');
                
                // Handle redirect if specified
                const redirect = form.dataset.redirect;
                if (redirect) {
                    setTimeout(() => {
                        window.location.href = redirect;
                    }, 1000);
                }
                
                // Reset form
                form.reset();
            } else {
                this.showError(result.error || 'Operation failed');
            }
        } catch (error) {
            console.error('Form submission error:', error);
            this.showError('Network error occurred');
        } finally {
            this.hideLoading();
        }
    },
    
    // API wrapper
    async api(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `${this.apiUrl}${endpoint}`;
        
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin'
        };
        
        // Add CSRF token if available
        if (this.csrfToken) {
            defaultOptions.headers['X-CSRFToken'] = this.csrfToken;
        }
        
        const config = { ...defaultOptions, ...options };
        
        return fetch(url, config);
    },
    
    // Authentication methods
    async logout() {
        try {
            await this.api('/logout', { method: 'POST' });
            window.location.href = '/';
        } catch (error) {
            console.error('Logout error:', error);
            window.location.href = '/';
        }
    },
    
    // Health data methods
    async refreshHealthTips() {
        const tipsContainer = document.getElementById('health-tips');
        if (!tipsContainer) return;
        
        this.showLoading(tipsContainer);
        
        try {
            const response = await this.api('/get-tips', { method: 'POST' });
            const data = await response.json();
            
            if (response.ok) {
                this.renderHealthTips(data.tips, tipsContainer);
            } else {
                tipsContainer.innerHTML = '<p class="text-danger">Failed to load health tips</p>';
            }
        } catch (error) {
            console.error('Tips error:', error);
            tipsContainer.innerHTML = '<p class="text-danger">Network error loading tips</p>';
        } finally {
            this.hideLoading();
        }
    },
    
    async refreshWeather() {
        const weatherContainer = document.getElementById('weather-widget');
        if (!weatherContainer) return;
        
        this.showLoading(weatherContainer);
        
        try {
            const response = await this.api('/weather');
            const data = await response.json();
            
            if (response.ok) {
                this.renderWeather(data, weatherContainer);
            } else {
                weatherContainer.innerHTML = '<p class="text-danger">Weather unavailable</p>';
            }
        } catch (error) {
            console.error('Weather error:', error);
            weatherContainer.innerHTML = '<p class="text-danger">Weather unavailable</p>';
        } finally {
            this.hideLoading();
        }
    },
    
    async refreshAlerts() {
        const alertsContainer = document.getElementById('health-alerts');
        if (!alertsContainer) return;
        
        this.showLoading(alertsContainer);
        
        try {
            const response = await this.api('/alerts');
            const data = await response.json();
            
            if (response.ok) {
                this.renderAlerts(data.alerts, alertsContainer);
            } else {
                alertsContainer.innerHTML = '<p class="text-warning">No alerts available</p>';
            }
        } catch (error) {
            console.error('Alerts error:', error);
            alertsContainer.innerHTML = '<p class="text-warning">Unable to load alerts</p>';
        } finally {
            this.hideLoading();
        }
    },
    
    // Rendering methods
    renderHealthTips(tips, container) {
        if (!tips || tips.length === 0) {
            container.innerHTML = '<p class="text-muted">No tips available at the moment.</p>';
            return;
        }
        
        const tipsHtml = tips.map(tip => `
            <div class="tip-item">
                <p class="mb-0">${this.escapeHtml(tip)}</p>
            </div>
        `).join('');
        
        container.innerHTML = tipsHtml;
    },
    
    renderWeather(data, container) {
        const current = data.current || {};
        const mockNote = data.mock_data ? '<small class="text-muted">(Demo data)</small>' : '';
        
        container.innerHTML = `
            <div class="weather-widget">
                <div class="weather-icon">🌤️</div>
                <div class="weather-temp">${current.temp || 'N/A'}°C</div>
                <div class="weather-desc">${current.description || 'No data'}</div>
                <div class="weather-details mt-3">
                    <small>
                        Feels like ${current.feels_like || 'N/A'}°C • 
                        Humidity ${current.humidity || 'N/A'}%
                    </small>
                    ${mockNote}
                </div>
            </div>
        `;
    },
    
    renderAlerts(alerts, container) {
        if (!alerts || alerts.length === 0) {
            container.innerHTML = '<p class="text-success">No health alerts at this time.</p>';
            return;
        }
        
        const alertsHtml = alerts.map(alert => `
            <div class="alert alert-${alert.type === 'warning' ? 'warning' : alert.type === 'caution' ? 'info' : 'info'} alert-dismissible fade show">
                <strong>${alert.icon || '⚠️'} ${alert.title}</strong><br>
                ${alert.message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `).join('');
        
        container.innerHTML = alertsHtml;
    },
    
    // Quick log modal
    showQuickLogModal() {
        const modalHtml = `
            <div class="modal fade" id="quickLogModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Quick Lifestyle Log</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form data-api="/log-lifestyle" data-redirect="/dashboard">
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">Sleep Hours</label>
                                        <input type="number" name="sleep_hours" class="form-control" min="0" max="24" step="0.5" required>
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">Exercise Minutes</label>
                                        <input type="number" name="exercise_minutes" class="form-control" min="0" max="1440" required>
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">Water Glasses</label>
                                        <input type="number" name="water_glasses" class="form-control" min="0" max="20" required>
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">Meals</label>
                                        <input type="text" name="meals" class="form-control" placeholder="e.g., Breakfast, Lunch, Dinner" required>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Notes (Optional)</label>
                                    <textarea name="notes" class="form-control" rows="2" placeholder="Any additional notes about your day"></textarea>
                                </div>
                                <div class="text-end">
                                    <button type="button" class="btn btn-secondary me-2" data-bs-dismiss="modal">Cancel</button>
                                    <button type="submit" class="btn btn-primary">Save Log</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal
        const existingModal = document.getElementById('quickLogModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add new modal
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('quickLogModal'));
        modal.show();
    },
    
    // Utility methods
    showLoading(container = null) {
        this.isLoading = true;
        
        if (container) {
            container.innerHTML = '<div class="text-center p-4"><div class="loading"></div></div>';
        } else {
            const overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.id = 'global-loading';
            overlay.innerHTML = '<div class="loading"></div>';
            document.body.appendChild(overlay);
        }
    },
    
    hideLoading() {
        this.isLoading = false;
        const overlay = document.getElementById('global-loading');
        if (overlay) {
            overlay.remove();
        }
    },
    
    showSuccess(message) {
        this.showNotification(message, 'success');
    },
    
    showError(message) {
        this.showNotification(message, 'danger');
    },
    
    showNotification(message, type = 'info') {
        const notificationHtml = `
            <div class="alert alert-${type} alert-dismissible fade show position-fixed" 
                 style="top: 20px; right: 20px; z-index: 9999; min-width: 300px;">
                ${this.escapeHtml(message)}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', notificationHtml);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            const alerts = document.querySelectorAll('.alert.position-fixed');
            alerts.forEach(alert => {
                if (alert.textContent.includes(message)) {
                    alert.remove();
                }
            });
        }, 5000);
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    formatDate(date) {
        return new Date(date).toLocaleDateString();
    },
    
    formatDateTime(date) {
        return new Date(date).toLocaleString();
    },
    
    // Theme management
    initTheme() {
        // Get saved theme or default to light
        const savedTheme = localStorage.getItem('healthcare-theme') || 'light';
        this.setTheme(savedTheme);
        
        // Setup theme toggle button
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
    },
    
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update toggle button icon
        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) {
            if (theme === 'dark') {
                themeIcon.className = 'fas fa-sun';
                themeIcon.parentElement.title = 'Switch to light mode';
            } else {
                themeIcon.className = 'fas fa-moon';
                themeIcon.parentElement.title = 'Switch to dark mode';
            }
        }
        
        // Save theme preference
        localStorage.setItem('healthcare-theme', theme);
    },
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
        
        // Show notification
        this.showNotification(
            `Switched to ${newTheme} mode`, 
            'success'
        );
    },
    
    // Mobile app specific features
    initMobileFeatures() {
        // Add offline indicator
        const offlineIndicator = document.createElement('div');
        offlineIndicator.className = 'offline-indicator';
        offlineIndicator.innerHTML = '<i class="fas fa-wifi me-2"></i>You are offline. Some features may be limited.';
        document.body.appendChild(offlineIndicator);
        
        // Monitor online/offline status
        window.addEventListener('online', () => {
            offlineIndicator.classList.remove('show');
            this.showNotification('Connection restored!', 'success');
        });
        
        window.addEventListener('offline', () => {
            offlineIndicator.classList.add('show');
            this.showNotification('You are now offline', 'warning');
        });
        
        // Add pull-to-refresh functionality
        this.initPullToRefresh();
        
        // Prevent zoom on form inputs (iOS)
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                const viewport = document.querySelector('meta[name=viewport]');
                if (viewport) {
                    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
                }
            });
            
            input.addEventListener('blur', () => {
                const viewport = document.querySelector('meta[name=viewport]');
                if (viewport) {
                    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, user-scalable=no');
                }
            });
        });
    },
    
    initPullToRefresh() {
        let startY = 0;
        let currentY = 0;
        let pullDistance = 0;
        let isPulling = false;
        
        document.addEventListener('touchstart', (e) => {
            if (window.scrollY === 0) {
                startY = e.touches[0].clientY;
                isPulling = true;
            }
        });
        
        document.addEventListener('touchmove', (e) => {
            if (isPulling && window.scrollY === 0) {
                currentY = e.touches[0].clientY;
                pullDistance = currentY - startY;
                
                if (pullDistance > 0) {
                    e.preventDefault();
                    
                    // Visual feedback for pull
                    if (pullDistance > 100) {
                        document.body.style.transform = `translateY(${Math.min(pullDistance - 100, 50)}px)`;
                        document.body.style.opacity = '0.8';
                    }
                }
            }
        });
        
        document.addEventListener('touchend', () => {
            if (isPulling && pullDistance > 150) {
                // Trigger refresh
                this.refreshPage();
            }
            
            // Reset visual state
            document.body.style.transform = '';
            document.body.style.opacity = '';
            isPulling = false;
            pullDistance = 0;
        });
    },
    
    refreshPage() {
        this.showNotification('Refreshing...', 'info');
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Export for use in other scripts
window.App = App;
