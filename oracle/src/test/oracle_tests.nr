use crate::ComplianceOracle;
use crate::ComplianceOracle::AuditRequest;
use aztec::protocol::address::AztecAddress;
use aztec::test::helpers::test_environment::TestEnvironment;

global JURISDICTION_EU: u32 = 1;

// ---- Setup helpers ----

unconstrained fn setup_oracle_2_of_3() -> (
    TestEnvironment,
    AztecAddress,
    AztecAddress,
    AztecAddress,
    AztecAddress,
) {
    let mut env = TestEnvironment::new();

    let approver_0 = env.create_light_account();
    let approver_1 = env.create_light_account();
    let approver_2 = env.create_light_account();
    let zero = AztecAddress::zero();

    let initializer_call = ComplianceOracle::interface().constructor(
        JURISDICTION_EU,
        2,
        approver_0,
        approver_1,
        approver_2,
        zero,
        zero,
    );
    let contract_address =
        env.deploy("ComplianceOracle").with_public_initializer(approver_0, initializer_call);

    (env, contract_address, approver_0, approver_1, approver_2)
}

// ---- Tests ----

#[test]
unconstrained fn test_constructor_stores_jurisdiction() {
    let (mut env, contract_address, _a0, _a1, _a2) = setup_oracle_2_of_3();

    let jurisdiction = env.view_public(
        ComplianceOracle::at(contract_address).get_jurisdiction(),
    );
    assert_eq(jurisdiction, JURISDICTION_EU);
}

#[test]
unconstrained fn test_constructor_stores_threshold() {
    let (mut env, contract_address, _a0, _a1, _a2) = setup_oracle_2_of_3();

    let threshold = env.view_public(
        ComplianceOracle::at(contract_address).get_threshold(),
    );
    assert_eq(threshold, 2);
}

#[test]
unconstrained fn test_constructor_stores_approvers() {
    let (mut env, contract_address, approver_0, approver_1, _a2) = setup_oracle_2_of_3();

    let stored_0 = env.view_public(ComplianceOracle::at(contract_address).get_approver(0));
    let stored_1 = env.view_public(ComplianceOracle::at(contract_address).get_approver(1));
    assert_eq(stored_0, approver_0);
    assert_eq(stored_1, approver_1);
}

#[test]
unconstrained fn test_submit_audit_request() {
    let (mut env, contract_address, approver_0, _a1, _a2) = setup_oracle_2_of_3();

    let employer = env.create_light_account();

    env.call_public(
        approver_0,
        ComplianceOracle::at(contract_address).submit_audit_request(employer, 1, 3),
    );

    let count = env.view_public(
        ComplianceOracle::at(contract_address).get_request_count(),
    );
    assert_eq(count, 1);
}

#[test]
unconstrained fn test_approve_request_increments_count() {
    let (mut env, contract_address, approver_0, _a1, _a2) = setup_oracle_2_of_3();

    let employer = env.create_light_account();

    env.call_public(
        approver_0,
        ComplianceOracle::at(contract_address).submit_audit_request(employer, 1, 3),
    );

    env.call_public(
        approver_0,
        ComplianceOracle::at(contract_address).approve_request(0),
    );

    let request: AuditRequest = env.view_public(
        ComplianceOracle::at(contract_address).get_request(0),
    );
    assert_eq(request.approval_count, 1);
}

#[test]
unconstrained fn test_threshold_reached_approves_request() {
    let (mut env, contract_address, approver_0, approver_1, _a2) = setup_oracle_2_of_3();

    let employer = env.create_light_account();

    env.call_public(
        approver_0,
        ComplianceOracle::at(contract_address).submit_audit_request(employer, 1, 3),
    );

    env.call_public(approver_0, ComplianceOracle::at(contract_address).approve_request(0));

    // Not approved yet (need 2 votes)
    let not_yet = env.view_public(ComplianceOracle::at(contract_address).is_request_approved(0));
    assert_eq(not_yet, false);

    // Second vote - threshold 2-of-3 reached
    env.call_public(approver_1, ComplianceOracle::at(contract_address).approve_request(0));

    let approved = env.view_public(ComplianceOracle::at(contract_address).is_request_approved(0));
    assert_eq(approved, true);
}

#[test(should_fail_with = "Caller is not a registered approver")]
unconstrained fn test_fail_non_approver_cannot_vote() {
    let (mut env, contract_address, approver_0, _a1, _a2) = setup_oracle_2_of_3();

    let employer = env.create_light_account();
    let random_user = env.create_light_account();

    env.call_public(
        approver_0,
        ComplianceOracle::at(contract_address).submit_audit_request(employer, 1, 3),
    );

    env.call_public(
        random_user,
        ComplianceOracle::at(contract_address).approve_request(0),
    );
}

#[test(should_fail_with = "Approver has already voted on this request")]
unconstrained fn test_fail_double_vote() {
    let (mut env, contract_address, approver_0, _a1, _a2) = setup_oracle_2_of_3();

    let employer = env.create_light_account();

    env.call_public(
        approver_0,
        ComplianceOracle::at(contract_address).submit_audit_request(employer, 1, 3),
    );

    env.call_public(approver_0, ComplianceOracle::at(contract_address).approve_request(0));
    env.call_public(approver_0, ComplianceOracle::at(contract_address).approve_request(0));
}

#[test]
unconstrained fn test_reject_request() {
    let (mut env, contract_address, approver_0, _a1, _a2) = setup_oracle_2_of_3();

    let employer = env.create_light_account();

    env.call_public(
        approver_0,
        ComplianceOracle::at(contract_address).submit_audit_request(employer, 1, 3),
    );

    env.call_public(approver_0, ComplianceOracle::at(contract_address).reject_request(0));

    let request: AuditRequest = env.view_public(ComplianceOracle::at(contract_address).get_request(0));
    assert_eq(request.status, 2); // STATUS_REJECTED
}

#[test(should_fail_with = "Request is not in pending status")]
unconstrained fn test_fail_approve_rejected_request() {
    let (mut env, contract_address, approver_0, approver_1, _a2) = setup_oracle_2_of_3();

    let employer = env.create_light_account();

    env.call_public(
        approver_0,
        ComplianceOracle::at(contract_address).submit_audit_request(employer, 1, 3),
    );

    env.call_public(approver_0, ComplianceOracle::at(contract_address).reject_request(0));
    env.call_public(approver_1, ComplianceOracle::at(contract_address).approve_request(0));
}

#[test]
unconstrained fn test_multiple_requests() {
    let (mut env, contract_address, approver_0, _a1, _a2) = setup_oracle_2_of_3();

    let employer1 = env.create_light_account();
    let employer2 = env.create_light_account();

    env.call_public(
        approver_0,
        ComplianceOracle::at(contract_address).submit_audit_request(employer1, 1, 3),
    );
    env.call_public(
        approver_0,
        ComplianceOracle::at(contract_address).submit_audit_request(employer2, 4, 6),
    );

    let count = env.view_public(ComplianceOracle::at(contract_address).get_request_count());
    assert_eq(count, 2);

    let req0: AuditRequest = env.view_public(ComplianceOracle::at(contract_address).get_request(0));
    let req1: AuditRequest = env.view_public(ComplianceOracle::at(contract_address).get_request(1));
    assert_eq(req0.employer, employer1);
    assert_eq(req1.employer, employer2);
}

#[test(should_fail_with = "Not enough approvers to meet threshold")]
unconstrained fn test_fail_deploy_threshold_exceeds_approvers() {
    let mut env = TestEnvironment::new();

    let approver_0 = env.create_light_account();
    let zero = AztecAddress::zero();

    let initializer_call = ComplianceOracle::interface().constructor(
        JURISDICTION_EU,
        3,
        approver_0,
        zero,
        zero,
        zero,
        zero,
    );
    let _ = env.deploy("ComplianceOracle").with_public_initializer(approver_0, initializer_call);
}
