# from langchain.text_splitter import RecursiveCharacterTextSplitter
# from langchain_ollama import OllamaEmbeddings

# Sample text to be split
# text = "CARE DONALD PHARRIS PRO POSAL OCTOBER 05, 2024 Dear Melissa, Is a daring family member concerned about the well-being and comfort of your loved one, am pleased to present the initial personalized proposal from Geriatric Are Solution to offer comprehensive care services designed to meet the unique needs of your family member. It Geriatric Are, we under Stand the importance of providing compassionate and professional care that enhanced quality of life and promotes independence. Should you have any questions feel free to text me on the number indicated below. Thanks, Raymond Villaroman Are Director 925.948.6464 gcsgcaresolution.com 10N1 CAREHOME MEMORY CARE SPECIALIST WWW.GERIATRICCARESOLUTION.COM 1.888.896.8275 ASKGCARESOLUTION.COM CARE DONALD PHARRIS PRO POSAL OCTOBER 05, 2024 Objective The primary goal of Donald's care plan is to restore and maintain his indeed dense and quality of life following a recent fall that necessitates his move to a skilled nursing facility. Geriatric Are Solutions is committed to providing a personalized care plan tailor to Donald's individual needs and references to ensure he can safely and effectively navigable his daily routine. Key object times include supporting Donald's mobility and ensuring his safety, especially as he is at a high risk for falls. The care plan also aims to provide comprehend give support for activities of daily living ADLs and instrumental activities of daily living IADLs that he cannot complete independently. Enhancing On and's overall well-being is of utmost importance, and his care plan will address physical, emotional, and social needs to foster a sense of normally, comfort, and autonomy. He will be mindful of his expressed preference for effective communication and facilitate his interactions with healthcare professional to ensure fearless coordination of his health care. Through target inter mentions and continuous assessment, this care plan intends to equip On and with the necessary tools and support mechanism while respecting his dignity and promoting his involvement in routine decision-making. 10N1 CAREHOME MEMORY CARE SPECIALIST WWW.GERIATRICCARESOLUTION.COM 1.888.896.8275 ASKGCARESOLUTION.COM CARE DONALD PHARRIS PRO POSAL OCTOBER 05, 2024 Well-Being And Health Management e Establish a regular schedule for doctor visits and checks, with a family member or caregiver to accompany Donald, ensuring all health concerns are promptly addressed and his care team is informed. Implement a dietary plan that aliens with Donald's restrictions, providing meal preparation services to ensure he has access to balanced and nut titus meals tailor to his needs. e Met up a daily meditation reminder system and arrange for a caregiver or family member to assist with meditation refills, ensuring consistency in Donald's meditation regiment. 10N1 CAREHOME MEMORY CARE SPECIALIST WWW.GERIATRICCARESOLUTION.COM 1.888.896.8275 ASKGCARESOLUTION"

# model = OllamaEmbeddings(model="bge-m3")


# embeddings = model.embed_documents([text])

# print(f"Length of embeddings: {len(embeddings[0])}")

# print(embeddings[0])


from marker.converters.pdf import PdfConverter
from marker.models import create_model_dict
from marker.output import text_from_rendered
import os

converter = PdfConverter(
    artifact_dict=create_model_dict(),
)
rendered = converter(os.path.join(os.path.dirname(__file__), "docs/35/35_original.pdf"))
text, _, images = text_from_rendered(rendered)

print(text)
