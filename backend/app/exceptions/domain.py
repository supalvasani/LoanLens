class DomainException(Exception):
    """Base class for all custom domain exceptions."""
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)

class ResourceNotFoundException(DomainException):
    def __init__(self, resource: str, resource_id: str | None = None):
        msg = f"{resource} not found" if not resource_id else f"{resource} with id {resource_id} not found"
        super().__init__(msg, status_code=404)

class InvalidCredentialsException(DomainException):
    def __init__(self):
        super().__init__("Invalid email or password", status_code=401)

class ResourceAlreadyExistsException(DomainException):
    def __init__(self, message: str):
        super().__init__(message, status_code=409)

class InsufficientPermissionsException(DomainException):
    def __init__(self):
        super().__init__("You do not have permission to perform this action", status_code=403)

class InsufficientAuthorityError(DomainException):
    def __init__(self, message: str = "Insufficient authority for this action"):
        super().__init__(message, status_code=403)


class EscalationRequiredError(DomainException):
    def __init__(self, message: str = "This case must be escalated to a Bank Manager"):
        super().__init__(message, status_code=403)
