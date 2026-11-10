from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
import requests
import base64
from typing import Optional

# Inicializa a aplicação FastAPI
app = FastAPI(title="AI Image Generator Service")

# --- Configurações de Ambiente (Idealmente em um arquivo .env) ---
HUGGINGFACE_API_TOKEN = "SUA_CHAVE_DE_API_HF" 
# Nota: Recomenda-se carregar isso via variáveis de ambiente.

class GenerationRequest(BaseModel):
    """Modelo de dados para a requisição do usuário."""
    prompt: str
    negative_prompt: Optional[str] = ""
    reference_image_base64: Optional[str] = None # Imagem base64 (para Image-to-Image)
    steps: int = 50

# --- Funções Auxiliares ---

def process_image_from_file(file: UploadFile) -> str:
    """Converte um arquivo de imagem para Base64."""
    contents = file.file.read()
    return base64.b64encode(contents).decode('utf-8')


# --- Motores de Geração (Implementação Principal) ---

def generate_via_huggingface(prompt: str, negative_prompt: Optional[str], reference_image_base64: Optional[str]) -> str:
    """
    Simula a chamada à API do Hugging Face. 
    Em um sistema real, você chamaria o endpoint específico (ex: Stable Diffusion).
    """
    print("--- Chamando Motor Externo: HuggingFace ---")
    headers = {"Authorization": f"Bearer {HUGGINGFACE_API_TOKEN}"}
    api_url = "https://api-inference.huggingface.co/models/run_model_id" # Substitua pelo modelo real

    payload = {
        "inputs": prompt, 
        "parameters": {"negative_prompt": negative_prompt, "image": reference_image_base64}
    }
    
    try:
        response = requests.post(api_url, headers=headers, json=payload)
        response.raise_for_status()
        # O retorno aqui seria a imagem binária ou uma URL de acesso
        return f"SUCESSO - Imagem gerada pela API externa (Status: {response.status_code}). Dados base64 simulados."
    except requests.exceptions.RequestException as e:
        print(f"Erro ao conectar à HF: {e}")
        raise HTTPException(status_code=503, detail="Serviço de geração externo indisponível.")


def generate_locally(prompt: str, negative_prompt: Optional[str], reference_image_base64: Optional[str]) -> str:
    """
    Placeholder para a lógica de execução local (Usando biblioteca Diffusers/PyTorch).
    Isso requer que o ambiente tenha PyTorch e modelos baixados.
    """
    print("--- Chamando Motor Local: Diffusers ---")
    # Aqui você carregaria um pipeline (ex: StableDiffusionPipeline)
    # 1. Carregar o modelo
    # 2. Processar a imagem de referência base64 para tensor
    # 3. Chamar model(prompt, negative_prompt, image=tensor)
    # 4. Salvar/Codificar o resultado.

    return f"SUCESSO - Imagem gerada localmente com controle máximo (Prompt: {prompt[:20]}...)."


# --- Endpoints da API FastAPI ---

@app.post("/generate")
async def generate_image(request: GenerationRequest, file: Optional[UploadFile] = File()):
    """
    Endpoint principal que orquestra a geração de imagem. 
    A lógica aqui deve decidir se usa o motor local ou o externo.
    """
    if not request.prompt:
        raise HTTPException(status_code=400, detail="O prompt é obrigatório.")

    # Lógica de Decisão (Exemplo: Se a chave for 'local', use generate_locally)
    # Para fins deste exemplo, vamos simular o uso do serviço externo por padrão.
    
    try:
        if request.reference_image_base64 and file:
            # Processa o arquivo de referência do upload (se houver um segundo arquivo)
            print("Recebido arquivo de referência adicional.")

        result = generate_via_huggingface(
            prompt=request.prompt, 
            negative_prompt=request.negative_prompt, 
            reference_image_base64=request.reference_image_base64
        )
        return {"status": "success", "generated_content": result}

    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Erro geral: {e}")
        raise HTTPException(status_code=500, detail="Ocorreu um erro interno no servidor.")


# --- Teste Simples (Para rodar o FastAPI) ---
@app.get("/")
def read_root():
    return {"message": "API de Geração de Imagens está online."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)