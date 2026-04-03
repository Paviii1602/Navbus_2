from flask import Flask
from flask_jwt_extended import create_access_token, JWTManager

app = Flask(__name__)
app.config['JWT_SECRET_KEY'] = 'navbus-super-secret-2024'
jwt = JWTManager(app)

with app.app_context():
    token = create_access_token(identity={'username': 'test', 'role': 'passenger'})
    print(f"JWT created: {token}")