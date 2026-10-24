import pytest
from skygarage_core.component_references import patent_reference, require_patent_reference
from skygarage_core.localization.ekf_fusion import SLEWING_RING_PATENT_ID
from skygarage_core.scheduler.multi_zone_engine import PATENT_SLEWING_RING, PATENT_EMERGENCY_BRAKE
from skygarage_diagnostic.harness.phm_chain import PATENT_EMERGENCY_BRAKE as diagnostic_brake


def test_filed_and_draft_symbols_have_distinct_explicit_editions():
    # Independent literals from filed paragraphs 0091/0130/0156 and draft v25-1.
    assert patent_reference('sg.robot.slewing_unit', edition='filed-10-2026-0016187') == '[280]'
    assert patent_reference('sg.robot.slewing_unit', edition='draft-v25-1') == '[220]'
    assert patent_reference('sg.robot.control_unit', edition='filed-10-2026-0016187') == '[270]'
    assert patent_reference('sg.robot.motor_drive', edition='draft-v25-1') == '[270]'
    assert patent_reference('sg.elevator.turntable', edition='filed-10-2026-0016187') == '[310]'
    assert SLEWING_RING_PATENT_ID == '[280]'
    assert PATENT_SLEWING_RING == '[280]'


def test_unknown_brake_mapping_never_reuses_control_unit_or_drive_number():
    assert PATENT_EMERGENCY_BRAKE is None
    assert diagnostic_brake is None
    with pytest.raises(ValueError, match='not_confirmed'):
        require_patent_reference('sg.safety.emergency_brake', edition='filed-10-2026-0016187')
    with pytest.raises(ValueError, match='unverified'):
        patent_reference('sg.robot.slewing_unit', edition='latest')
    with pytest.raises(TypeError):
        patent_reference('sg.robot.slewing_unit')
