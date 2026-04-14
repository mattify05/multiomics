"""Typed spatial pipeline errors with stable error codes for the API error envelope."""

from __future__ import annotations


class SpatialPipelineError(Exception):
    """Base class for spatial pipeline errors surfaced through the API."""

    error_code: str = "RUNNER_EXCEPTION"
    retryable: bool = False

    def __init__(self, message: str, *, error_code: str | None = None, retryable: bool | None = None) -> None:
        super().__init__(message)
        if error_code is not None:
            self.error_code = error_code
        if retryable is not None:
            self.retryable = retryable


class MissingFileError(SpatialPipelineError):
    error_code = "MISSING_FILE"
    retryable = False


class DependencyError(SpatialPipelineError):
    error_code = "DEPENDENCY_ERROR"
    retryable = False


class InsufficientDataError(SpatialPipelineError):
    error_code = "INSUFFICIENT_DATA"
    retryable = False


class InsufficientSharedGenesError(SpatialPipelineError):
    error_code = "INSUFFICIENT_SHARED_GENES"
    retryable = False


class MissingLabelColumnError(SpatialPipelineError):
    error_code = "MISSING_LABEL_COLUMN"
    retryable = False


class SyntheticFallbackDisabledError(SpatialPipelineError):
    error_code = "SYNTHETIC_FALLBACK_DISABLED"
    retryable = False
