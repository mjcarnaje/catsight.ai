def get_psycopg_connection_string(uri):
    """Convert SQLAlchemy URI to psycopg compatible format"""
    if uri.startswith("postgresql+psycopg://"):
        return uri.replace("postgresql+psycopg://", "postgresql://")
    return uri
