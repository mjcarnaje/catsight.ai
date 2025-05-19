import json

notebook = {
    "cells": [
        {
            "cell_type": "code",
            "execution_count": None,
            "id": "7b60e710-d85a-42e0-9b30-0903d9477886",
            "metadata": {},
            "outputs": [],
            "source": [
                "import sys\n",
                "sys.path.append('..')\n",
                "from app.services.vectorstore import retriever, DB_URI\n",
                "\n",
                "print(f\"DB_URI: {DB_URI}\")\n",
                "print(f\"Retriever: {retriever}\")"
            ]
        }
    ],
    "metadata": {
        "kernelspec": {
            "display_name": "Python 3 (ipykernel)",
            "language": "python",
            "name": "python3"
        },
        "language_info": {
            "codemirror_mode": {
                "name": "ipython",
                "version": 3
            },
            "file_extension": ".py",
            "mimetype": "text/x-python",
            "name": "python",
            "nbconvert_exporter": "python",
            "pygments_lexer": "ipython3",
            "version": "3.11.12"
        }
    },
    "nbformat": 4,
    "nbformat_minor": 5
}

with open('Test.ipynb', 'w') as f:
    json.dump(notebook, f)

print("Notebook created successfully") 