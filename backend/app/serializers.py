from rest_framework import serializers
from .models import User, Document, LLMModel, DocumentStatusHistory
import json
import logging

logger = logging.getLogger(__name__)


class UserSerializer(serializers.ModelSerializer):
    favorite_llm_models = serializers.SerializerMethodField()
    
    def get_favorite_llm_models(self, obj):
        return [model.code for model in obj.favorite_llm_models.all()]
    
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'username', 'role', 'avatar', 'favorite_llm_models']
        read_only_fields = ['id', 'role']
    
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    password_confirm = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    
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
        fields = '__all__'


class LLMModelSerializer(serializers.ModelSerializer):
    logo = serializers.CharField(read_only=True)

    class Meta:
        model = LLMModel
        fields = ['id', 'code', 'name', 'description', 'logo']
