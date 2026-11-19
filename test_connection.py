from sqlalchemy import text

from app.database.connection import engine

if __name__ == "__main__":
    with engine.connect() as connection:
        database_name = connection.execute(text("SELECT DATABASE()")).scalar()
    print("MySQL connection successful.")
    print(f"Connected database: {database_name}")
