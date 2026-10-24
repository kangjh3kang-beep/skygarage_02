"""Versioned document references, never device addresses or operating limits.

The filed application and v25-1 draft use different drawing reference numbers.
Unknown mappings stay absent; callers must not substitute a legacy number.
"""
from types import MappingProxyType

FILED_APPLICATION = "filed-10-2026-0016187"
DRAFT_V25_1 = "draft-v25-1"
SLEWING_COMPONENT_ID = "sg.robot.slewing_unit"
EMERGENCY_BRAKE_COMPONENT_ID = "sg.safety.emergency_brake"

_REFERENCES = MappingProxyType({
    FILED_APPLICATION: MappingProxyType({
        SLEWING_COMPONENT_ID: "[280]",  # Filed paragraphs 0091–0093.
        "sg.robot.control_unit": "[270]",  # Filed paragraphs 0129–0130.
        "sg.elevator.turntable": "[310]",  # Filed paragraph 0156, optional.
        EMERGENCY_BRAKE_COMPONENT_ID: None,
    }),
    DRAFT_V25_1: MappingProxyType({
        SLEWING_COMPONENT_ID: "[220]",
        "sg.robot.motor_drive": "[270]",
        "sg.elevator.turntable": "[310]",
        EMERGENCY_BRAKE_COMPONENT_ID: None,
    }),
})


def patent_reference(component_id: str, *, edition: str) -> str | None:
    """Require an explicit edition; reject unknown components/editions."""
    if edition not in _REFERENCES or component_id not in _REFERENCES[edition]:
        raise ValueError("unverified_component_reference")
    return _REFERENCES[edition][component_id]


def require_patent_reference(component_id: str, *, edition: str) -> str:
    reference = patent_reference(component_id, edition=edition)
    if reference is None:
        raise ValueError("component_reference_not_confirmed")
    return reference
