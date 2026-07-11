import logging
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure
from app.config import settings

logger = logging.getLogger(__name__)

# Fallback database mock for robust offline execution
class InMemoryDatabase:
    def __init__(self):
        self.documents = []
        self.messages = []
        self.evaluation_runs = []
        logger.warning("Using In-Memory Fallback Database because MongoDB connection failed.")
        
    class MockCollection:
        def __init__(self, data_list):
            self.data_list = data_list
            
        async def insert_one(self, doc):
            self.data_list.append(doc)
            return type('InsertOneResult', (object,), {'inserted_id': doc.get('_id', str(len(self.data_list)))})()
            
        async def insert_many(self, docs):
            self.data_list.extend(docs)
            return type('InsertManyResult', (object,), {'inserted_ids': [d.get('_id') for d in docs]})()
            
        async def find_one(self, filter):
            for item in self.data_list:
                if all(item.get(k) == v for k, v in filter.items()):
                    return item
            return None
            
        def find(self, filter=None):
            filter = filter or {}
            matched = []
            for item in self.data_list:
                if all(item.get(k) == v for k, v in filter.items()):
                    matched.append(item)
            
            # Simple cursor mock
            class MockCursor:
                def __init__(self, items):
                    self.items = items
                def sort(self, key, direction=1):
                    # quick sort mock if key is passed
                    try:
                        self.items.sort(key=lambda x: x.get(key, 0), reverse=(direction == -1))
                    except:
                        pass
                    return self
                def limit(self, count):
                    self.items = self.items[:count]
                    return self
                async def to_list(self, length=None):
                    if length:
                        return self.items[:length]
                    return self.items
                def __aiter__(self):
                    return self
                async def __anext__(self):
                    if not self.items:
                        raise StopAsyncIteration
                    return self.items.pop(0)
            return MockCursor(matched)

        async def delete_one(self, filter):
            for i, item in enumerate(self.data_list):
                if all(item.get(k) == v for k, v in filter.items()):
                    self.data_list.pop(i)
                    return type('DeleteResult', (object,), {'deleted_count': 1})()
            return type('DeleteResult', (object,), {'deleted_count': 0})()

        async def delete_many(self, filter):
            initial_len = len(self.data_list)
            self.data_list = [item for item in self.data_list if not all(item.get(k) == v for k, v in filter.items())]
            deleted = initial_len - len(self.data_list)
            return type('DeleteResult', (object,), {'deleted_count': deleted})()

        async def update_one(self, filter, update):
            # simple update mock
            for item in self.data_list:
                if all(item.get(k) == v for k, v in filter.items()):
                    if '$set' in update:
                        item.update(update['$set'])
                    return type('UpdateResult', (object,), {'modified_count': 1})()
            return type('UpdateResult', (object,), {'modified_count': 0})()

    def __getitem__(self, name):
        if name == "documents":
            return self.MockCollection(self.documents)
        elif name == "messages":
            return self.MockCollection(self.messages)
        elif name == "evaluation_runs":
            return self.MockCollection(self.evaluation_runs)
        else:
            if not hasattr(self, name):
                setattr(self, name, [])
            return self.MockCollection(getattr(self, name))


client = None
db = None
is_mongodb_connected = False

try:
    # Try connecting with a 2-second timeout to avoid hanging startup
    client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=2000)
    db = client[settings.DATABASE_NAME]
    # We can check connectivity on startup, but for now we set up client
    is_mongodb_connected = True
except Exception as e:
    logger.error(f"Failed to connect to MongoDB: {e}")
    db = InMemoryDatabase()
    is_mongodb_connected = False

async def check_db_connection():
    global db, is_mongodb_connected
    if not is_mongodb_connected:
        return False
    try:
        await client.admin.command('ping')
        return True
    except Exception:
        db = InMemoryDatabase()
        is_mongodb_connected = False
        return False
