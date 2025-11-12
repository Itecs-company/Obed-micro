from collections import deque
from datetime import datetime
from typing import Deque, Dict, List

from .schemas import LogEntry

MAX_LOG_ENTRIES = 200


class LogManager:
    def __init__(self) -> None:
        self._entries: Deque[LogEntry] = deque(maxlen=MAX_LOG_ENTRIES)

    def add(self, level: str, message: str) -> None:
        entry = LogEntry(timestamp=datetime.utcnow(), level=level.upper(), message=message)
        self._entries.appendleft(entry)

    def list(self) -> List[LogEntry]:
        return list(self._entries)


log_manager = LogManager()
