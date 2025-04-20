from ..models import LLMModel
from ..serializers import LLMModelSerializer
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from app.utils.permissions import AllowAny

@api_view(['GET'])
@permission_classes([AllowAny])
def get_llm_models(request):
    llm_models = LLMModel.objects.all().order_by('name')
    serializer = LLMModelSerializer(llm_models, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_llm_model(request, pk):
    llm_model = LLMModel.objects.get(pk=pk)
    serializer = LLMModelSerializer(llm_model)
    return Response(serializer.data)

