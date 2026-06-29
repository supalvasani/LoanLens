import logging
from pathlib import Path
from logging.handlers import TimedRotatingFileHandler
from pythonjsonlogger import jsonlogger
from app.core.config import settings

def setup_logger() -> logging.Logger:
    """
    Sets up a TimedRotatingFileHandler that rotates hourly.
    Logs are written in structured JSON format.
    """
    log_dir = Path(__file__).resolve().parents[2] / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    
    # We use a distinct logger name for the application
    logger = logging.getLogger("loanlens")
    
    # Avoid attaching handlers multiple times if imported in different modules
    if logger.hasHandlers():
        return logger

    logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
    
    # Base filename, the rotating handler will append the suffix
    base_filename = log_dir / "app.log"
    
    # Rotate every 1 hour (when="H", interval=1)
    handler = TimedRotatingFileHandler(
        filename=base_filename,
        when="H",
        interval=1,
        backupCount=settings.LOG_BACKUP_COUNT,
        encoding="utf-8"
    )
    
    # Pattern: logs/app_YYYY-MM-DD_HH.log
    handler.suffix = "%Y-%m-%d_%H.log"
    handler.namer = lambda default_name: str(
        log_dir / f"app_{Path(default_name).name.rsplit('.', 1)[-1]}"
    )
    
    # Define the fields to include in JSON
    format_str = "%(asctime)s %(levelname)s %(name)s %(message)s %(module)s %(funcName)s %(lineno)d"
    
    # Rename standard logging fields to match requirements
    formatter = jsonlogger.JsonFormatter(
        format_str,
        rename_fields={
            "asctime": "timestamp",
            "levelname": "level",
            "name": "logger_name",
            "funcName": "function",
            "lineno": "line_number"
        }
    )
    
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    
    # Optional: Add console output for development
    if settings.APP_ENV == "development":
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
        
    return logger

logger = setup_logger()
