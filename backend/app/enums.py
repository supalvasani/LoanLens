import enum


class RoleEnum(enum.StrEnum):
    admin = "admin"
    manager = "manager"
    analyst = "analyst"
    applicant = "applicant"

class DecisionEnum(enum.StrEnum):
    approved = "approved"
    rejected = "rejected"
    escalated = "escalated"

class LoanTypeEnum(enum.StrEnum):
    home_loan = "home_loan"
    personal_loan = "personal_loan"
    auto_loan = "auto_loan"
    education_loan = "education_loan"
    two_wheeler_loan = "two_wheeler_loan"
    business_loan = "business_loan"

class RiskTierEnum(enum.StrEnum):
    low = "low"
    medium = "medium"
    high = "high"

class TxnTypeEnum(enum.StrEnum):
    credit = "credit"
    debit = "debit"

class ApplicationStatusEnum(enum.StrEnum):
    pending = "pending"
    under_review = "under_review"
    approved = "approved"
    rejected = "rejected"
    escalated = "escalated"
