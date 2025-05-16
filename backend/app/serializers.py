from rest_framework import serializers
from .models import User, Document, DocumentStatusHistory, Chat
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'username', 'role', 'avatar', 'is_onboarded', 'is_dev_mode']
        read_only_fields = ['id', 'role']
    
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    password_confirm = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    first_name = serializers.CharField(required=True)
    last_name = serializers.CharField(required=True)
    
    class Meta:
        model = User
        fields = ['email', 'first_name', 'last_name', 'username', 'password', 'password_confirm']
    
    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError("Passwords do not match.")
        
        # Validate MSU-IIT email domain
        if not data['email'].endswith('@g.msuiit.edu.ph'):
            raise serializers.ValidationError("Only users with @g.msuiit.edu.ph email addresses are allowed.")
        
        return data
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(
            email=validated_data['email'],
            username=validated_data.get('username', validated_data['email'].split('@')[0]),
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True, style={'input_type': 'password'})


class GoogleAuthSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)


class DocumentStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentStatusHistory
        fields = ['id', 'status', 'changed_at']


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by = UserSerializer(read_only=True)
    status_history = DocumentStatusHistorySerializer(many=True, read_only=True)
    
    class Meta:
        model = Document
        fields = ['id', 'title', 'summary', 'year', 'tags', 'file', 'file_name', 'file_type', 
                 'preview_image', 'blurhash', 'status', 'is_failed', 'task_id', 
                 'markdown_converter', 'summarization_model', 'no_of_chunks', 'created_at', 'updated_at', 
                 'uploaded_by', 'status_history']


class ChatSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = Chat
        fields = ['id', 'title', 'created_at', 'updated_at', 'user', 'document']
