import os
import logging
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash
from flask_session import Session
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.middleware.proxy_fix import ProxyFix

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Configure session
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_PERMANENT'] = False
app.config['SESSION_USE_SIGNER'] = True
Session(app)

# Import models and services
from models import init_storage, users_db, profiles_db, lifestyle_logs_db, payments_db
from auth import auth_bp, require_login
from health_api import health_bp
from payments import payments_bp

# Initialize storage
init_storage()

# Register blueprints
app.register_blueprint(auth_bp, url_prefix='/api')
app.register_blueprint(health_bp, url_prefix='/api')
app.register_blueprint(payments_bp, url_prefix='/api')

# CORS setup
@app.after_request
def after_request(response):
    origin = request.headers.get('Origin')
    if origin:
        response.headers.add('Access-Control-Allow-Origin', origin)
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

@app.route('/api/cors', methods=['OPTIONS'])
def handle_options():
    return '', 200

# Main routes
@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('index.html')

@app.route('/register')
def register():
    return render_template('register.html')

@app.route('/login')
def login():
    return render_template('login.html')

@app.route('/dashboard')
@require_login
def dashboard():
    user_id = session['user_id']
    user = users_db.get(user_id)
    profile = profiles_db.get(user_id)
    
    # Get recent lifestyle logs
    recent_logs = []
    if user_id in lifestyle_logs_db:
        user_logs = lifestyle_logs_db[user_id]
        recent_logs = sorted(user_logs, key=lambda x: x['date'], reverse=True)[:7]
    
    return render_template('dashboard.html', user=user, profile=profile, recent_logs=recent_logs)

@app.route('/profile')
@require_login
def profile():
    user_id = session['user_id']
    user = users_db.get(user_id)
    profile = profiles_db.get(user_id)
    return render_template('profile.html', user=user, profile=profile)

@app.route('/lifestyle')
@require_login
def lifestyle():
    return render_template('lifestyle.html')

@app.route('/chat')
@require_login
def chat():
    return render_template('chat.html')

@app.route('/premium')
@require_login
def premium():
    user_id = session['user_id']
    user = users_db.get(user_id)
    return render_template('premium.html', user=user)

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return render_template('base.html', error='Page not found'), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal error: {error}")
    return render_template('base.html', error='Internal server error'), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))  # Railway sets PORT dynamically
    app.run(host='0.0.0.0', port=port, debug=True)

