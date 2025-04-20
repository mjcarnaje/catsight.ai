#!/bin/bash

# Create a new user with the given username and password
python manage.py createsuperuser --username admin --email michaeljames.carnaje@g.msuiit.edu.ph --noinput

# Set the password for the new user
python manage.py changepassword password

echo "Default user created successfully"