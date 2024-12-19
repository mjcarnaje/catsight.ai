from marker.config.parser import ConfigParser
from marker.converters.pdf import PdfConverter
from marker.models import create_model_dict

config = {
    "output_format": "markdown",
    "disable_multiprocessing": True,
    "disable_image_extraction": True,
}

config_parser = ConfigParser(config)
        
pdf_converter = PdfConverter(
    config=config_parser.generate_config_dict(),
    artifact_dict=create_model_dict(),
    processor_list=config_parser.get_processors(),
    renderer=config_parser.get_renderer()
)       