import enum

class RoleEnum(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    analyst = "analyst"
    applicant = "applicant"

class DecisionEnum(str, enum.Enum):
    approved = "approved"
    rejected = "rejected"
    escalated = "escalated"

class LoanTypeEnum(str, enum.Enum):
    home_loan = "home_loan"
    personal_loan = "personal_loan"
    auto_loan = "auto_loan"
    education_loan = "education_loan"
    two_wheeler_loan = "two_wheeler_loan"
    business_loan = "business_loan"

class RiskTierEnum(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"

class TxnTypeEnum(str, enum.Enum):
    credit = "credit"
    debit = "debit"

class ApplicationStatusEnum(str, enum.Enum):
    pending = "pending"
    under_review = "under_review"
    approved = "approved"
    rejected = "rejected"
    escalated = "escalated"
