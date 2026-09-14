import logging
from typing import Dict, Type, List, Any, Optional
from app.connectors.base import BaseConnector
from app.schemas.connection import ConnectorInfo

logger = logging.getLogger(__name__)


class ConnectorRegistry:
    """
    Central Registry for data source connectors.
    Enables plug-and-play addition of new data sources.
    without modifying core application logic.
    """

    _registry: Dict[str, Type[BaseConnector]] = {}
    _registered_infos: Dict[str, ConnectorInfo] = {}

    @classmethod
    def register(cls, connector_type: str, connector_class: Type[BaseConnector]):
        """Register a new connector class under a type identifier."""
        clean_type = connector_type.lower().strip()
        cls._registry[clean_type] = connector_class
        try:
            cls._registered_infos[clean_type] = connector_class.get_connector_info()
        except Exception as e:
            logger.warning(f"Could not load connector info for {connector_type}: {e}")
        logger.info(
            f"Registered connector type: {clean_type} -> {connector_class.__name__}"
        )

    @classmethod
    def get_connector_class(cls, connector_type: str) -> Optional[Type[BaseConnector]]:
        return cls._registry.get(connector_type.lower().strip())

    @classmethod
    def instantiate(cls, connector_type: str, config: Dict[str, Any]) -> BaseConnector:
        connector_cls = cls.get_connector_class(connector_type)
        if not connector_cls:
            raise ValueError(
                f"Unsupported or unregistered connector type: '{connector_type}'. "
                f"Available active connectors: {list(cls._registry.keys())}"
            )
        return connector_cls(config)

    @classmethod
    def list_connectors(cls) -> List[ConnectorInfo]:
        """Return all registered connector schemas for frontend form generation."""
        return list(cls._registered_infos.values())

    @classmethod
    def is_supported(cls, connector_type: str) -> bool:
        return connector_type.lower().strip() in cls._registry


# Initialize and auto-register active connectors
def init_registry():
    from app.connectors.mongodb import MongoDBConnector

    ConnectorRegistry.register("mongodb", MongoDBConnector)


# Run initialization
init_registry()
