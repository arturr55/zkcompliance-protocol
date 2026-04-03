use crate::test::utils;
use crate::PrivatePayroll;

use aztec::protocol::address::AztecAddress;

global JURISDICTION_EU: u32 = 1;

// ---- Setup helpers ----

// Setup + create employer and employee accounts + verify KYC + deposit escrow
unconstrained fn setup_with_kyc_and_escrow(deposit_amount: u128) -> (
    aztec::test::helpers::test_environment::TestEnvironment,
    AztecAddress, // contract
    AztecAddress, // admin
    AztecAddress, // employer
    AztecAddress, // employee
    AztecAddress, // eu_oracle
) {
    let (mut env, contract_address, admin, eu_oracle, _us_oracle, _sg_oracle) = utils::setup();

    let employer = env.create_contract_account();
    let employee = env.create_contract_account();

    // Admin verifies employer KYC
    env.call_public(
        admin,
        PrivatePayroll::at(contract_address).verify_employer_kyc(employer),
    );

    // Employer deposits escrow
    env.call_public(
        employer,
        PrivatePayroll::at(contract_address).deposit_payroll(deposit_amount),
    );

    (env, contract_address, admin, employer, employee, eu_oracle)
}

// Convenience: setup with large enough escrow for tests
unconstrained fn setup_with_kyc() -> (
    aztec::test::helpers::test_environment::TestEnvironment,
    AztecAddress,
    AztecAddress,
    AztecAddress,
    AztecAddress,
    AztecAddress,
) {
    setup_with_kyc_and_escrow(100000 as u128)
}

// ---- Tests ----

#[test]
unconstrained fn test_initializer_admin() {
    let (mut env, contract_address, admin, _eu_oracle, _us_oracle, _sg_oracle) = utils::setup();

    env.public_context_at(contract_address, |context| {
        let stored_admin: AztecAddress =
            context.storage_read(PrivatePayroll::storage_layout().admin.slot);
        assert_eq(stored_admin, admin);
    });
}

#[test]
unconstrained fn test_verify_employer_kyc() {
    let (mut env, contract_address, admin, _eu_oracle, _us_oracle, _sg_oracle) = utils::setup();
    let employer = env.create_light_account();

    let before = env.view_public(
        PrivatePayroll::at(contract_address).is_kyc_verified(employer),
    );
    assert_eq(before, false);

    env.call_public(
        admin,
        PrivatePayroll::at(contract_address).verify_employer_kyc(employer),
    );

    let after = env.view_public(
        PrivatePayroll::at(contract_address).is_kyc_verified(employer),
    );
    assert_eq(after, true);
}

#[test(should_fail_with = "Only admin can verify KYC (MVP mode)")]
unconstrained fn test_fail_kyc_by_non_admin() {
    let (mut env, contract_address, _admin, _eu_oracle, _us_oracle, _sg_oracle) = utils::setup();
    let random_user = env.create_light_account();
    let employer = env.create_light_account();

    env.call_public(
        random_user,
        PrivatePayroll::at(contract_address).verify_employer_kyc(employer),
    );
}

#[test]
unconstrained fn test_deposit_payroll() {
    let (mut env, contract_address, admin, _eu_oracle, _us_oracle, _sg_oracle) = utils::setup();
    let employer = env.create_contract_account();

    // KYC first
    env.call_public(admin, PrivatePayroll::at(contract_address).verify_employer_kyc(employer));

    // Before deposit
    let before = env.view_public(
        PrivatePayroll::at(contract_address).get_escrow_balance(employer),
    );
    assert_eq(before, 0 as u128);

    // Deposit
    env.call_public(
        employer,
        PrivatePayroll::at(contract_address).deposit_payroll(10000 as u128),
    );

    // After deposit
    let after = env.view_public(
        PrivatePayroll::at(contract_address).get_escrow_balance(employer),
    );
    assert_eq(after, 10000 as u128);
}

#[test(should_fail_with = "Employer must complete KYC before depositing")]
unconstrained fn test_fail_deposit_without_kyc() {
    let (mut env, contract_address, _admin, _eu_oracle, _us_oracle, _sg_oracle) = utils::setup();
    let employer = env.create_contract_account();

    // Deposit without KYC - must fail
    env.call_public(
        employer,
        PrivatePayroll::at(contract_address).deposit_payroll(5000 as u128),
    );
}

#[test]
unconstrained fn test_issue_salary_increments_payroll() {
    let (mut env, contract_address, _admin, employer, employee, _eu_oracle) =
        setup_with_kyc();

    let before = env.view_public(
        PrivatePayroll::at(contract_address).get_payroll_commitment(employer),
    );
    assert_eq(before, 0 as u128);

    let amount: u128 = 5000;
    env.call_private(
        employer,
        PrivatePayroll::at(contract_address).issue_salary(employee, amount, 1, JURISDICTION_EU),
    );

    let after = env.view_public(
        PrivatePayroll::at(contract_address).get_payroll_commitment(employer),
    );
    assert_eq(after, amount);
}

#[test]
unconstrained fn test_issue_salary_deducts_escrow() {
    let deposit: u128 = 20000;
    let salary: u128 = 5000;
    let (mut env, contract_address, _admin, employer, employee, _eu_oracle) =
        setup_with_kyc_and_escrow(deposit);

    // Escrow before
    let escrow_before = env.view_public(
        PrivatePayroll::at(contract_address).get_escrow_balance(employer),
    );
    assert_eq(escrow_before, deposit);

    // Issue salary
    env.call_private(
        employer,
        PrivatePayroll::at(contract_address).issue_salary(employee, salary, 1, JURISDICTION_EU),
    );

    // Escrow after: deposit - salary
    let escrow_after = env.view_public(
        PrivatePayroll::at(contract_address).get_escrow_balance(employer),
    );
    assert_eq(escrow_after, deposit - salary);
}

#[test(should_fail_with = "Insufficient escrow balance: deposit payroll first")]
unconstrained fn test_fail_issue_salary_without_escrow() {
    let (mut env, contract_address, admin, _eu_oracle, _us_oracle, _sg_oracle) = utils::setup();
    let employer = env.create_contract_account();
    let employee = env.create_contract_account();

    // KYC but NO deposit
    env.call_public(admin, PrivatePayroll::at(contract_address).verify_employer_kyc(employer));

    // Issue without escrow - must fail
    env.call_private(
        employer,
        PrivatePayroll::at(contract_address).issue_salary(employee, 5000 as u128, 1, JURISDICTION_EU),
    );
}

#[test]
unconstrained fn test_issue_salary_twice_accumulates() {
    let (mut env, contract_address, _admin, employer, employee, _eu_oracle) =
        setup_with_kyc();

    let employee2 = env.create_light_account();

    let amount1: u128 = 3000;
    let amount2: u128 = 4500;

    env.call_private(
        employer,
        PrivatePayroll::at(contract_address).issue_salary(employee, amount1, 1, JURISDICTION_EU),
    );
    env.call_private(
        employer,
        PrivatePayroll::at(contract_address).issue_salary(employee2, amount2, 1, JURISDICTION_EU),
    );

    let total = env.view_public(
        PrivatePayroll::at(contract_address).get_payroll_commitment(employer),
    );
    assert_eq(total, amount1 + amount2);
}

#[test(should_fail_with = "Employer must complete KYC verification first")]
unconstrained fn test_fail_issue_salary_without_kyc() {
    let (mut env, contract_address, _admin, _eu_oracle, _us_oracle, _sg_oracle) = utils::setup();

    let employer = env.create_contract_account();
    let employee = env.create_contract_account();

    env.call_private(
        employer,
        PrivatePayroll::at(contract_address).issue_salary(employee, 1000 as u128, 1, JURISDICTION_EU),
    );
}

#[test]
unconstrained fn test_claim_salary() {
    let (mut env, contract_address, _admin, employer, employee, _eu_oracle) =
        setup_with_kyc();

    env.call_private(
        employer,
        PrivatePayroll::at(contract_address).issue_salary(employee, 5000 as u128, 1, JURISDICTION_EU),
    );

    env.call_private(
        employee,
        PrivatePayroll::at(contract_address).claim_salary(employer),
    );
}

#[test(should_fail)]
unconstrained fn test_fail_double_claim() {
    let (mut env, contract_address, _admin, employer, employee, _eu_oracle) =
        setup_with_kyc();

    env.call_private(
        employer,
        PrivatePayroll::at(contract_address).issue_salary(employee, 5000 as u128, 1, JURISDICTION_EU),
    );

    // First claim - ok
    env.call_private(
        employee,
        PrivatePayroll::at(contract_address).claim_salary(employer),
    );

    // Second claim - must fail (nullifier already exists)
    env.call_private(
        employee,
        PrivatePayroll::at(contract_address).claim_salary(employer),
    );
}

#[test]
unconstrained fn test_issue_salary_twice_same_employee_different_periods() {
    let (mut env, contract_address, _admin, employer, employee, _eu_oracle) =
        setup_with_kyc();

    env.call_private(
        employer,
        PrivatePayroll::at(contract_address).issue_salary(employee, 5000 as u128, 1, JURISDICTION_EU),
    );
    env.call_private(
        employer,
        PrivatePayroll::at(contract_address).issue_salary(employee, 5000 as u128, 2, JURISDICTION_EU),
    );

    let total = env.view_public(
        PrivatePayroll::at(contract_address).get_payroll_commitment(employer),
    );
    assert_eq(total, 10000 as u128);
}

#[test]
unconstrained fn test_get_compliance_oracle() {
    let (mut env, contract_address, _admin, eu_oracle, _us_oracle, _sg_oracle) = utils::setup();

    let stored_oracle = env.view_public(
        PrivatePayroll::at(contract_address).get_compliance_oracle(JURISDICTION_EU),
    );
    assert_eq(stored_oracle, eu_oracle);
}
