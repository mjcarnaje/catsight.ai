import json
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from app.utils.permissions import AllowAny

@api_view(['GET'])
@permission_classes([AllowAny])
def get_llm_models(request):

    instruct = request.query_params.get('instruct', 'false')    
    
    # Add id field to each model based on its position in the list
    with open('app/constant/llm.json', 'r') as f:
        llm_models = json.load(f)
    models_with_ids = []
    for i, model in enumerate(llm_models, 1):
        if instruct == 'true' and model['instruct'] == False:
            continue
        model_with_id = model.copy()
        model_with_id['id'] = i
        models_with_ids.append(model_with_id)
    
    return Response(models_with_ids)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_llm_model(request, pk):
    try:
        with open('app/constant/llm.json', 'r') as f:
            llm_models = json.load(f)
        # Since pk is an integer in the URL pattern, use it as index
        if 0 < pk <= len(llm_models):
            model = llm_models[pk-1].copy()
            model['id'] = pk
            return Response(model)
        else:
            return Response({'error': 'LLM model not found'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

