use aztec::{protocol::address::AztecAddress, test::helpers::test_environment::TestEnvironment};

use crate::PrivatePayroll;

/// Deploy contract and return (env, contract_address, admin, eu_oracle, us_oracle, sg_oracle)
/// Accounts that only call public functions use create_light_account (faster).
/// Accounts that participate in private function calls (own notes, emit nullifiers)
/// must use create_contract_account so their keys are accessible cross-context.
pub unconstrained fn setup() -> (TestEnvironment, AztecAddress, AztecAddress, AztecAddress, AztecAddress, AztecAddress) {
    let mut env = TestEnvironment::new();

    // Admin only calls public functions - light account is sufficient
    let admin     = env.create_light_account();
    // Oracles receive ComplianceNotes (private notes) - need contract account for key access
    let eu_oracle = env.create_contract_account();
    let us_oracle = env.create_contract_account();
    let sg_oracle = env.create_contract_account();

    let initializer_call = PrivatePayroll::interface().constructor(
        admin,
        eu_oracle,
        us_oracle,
        sg_oracle,
    );
    let contract_address =
        env.deploy("PrivatePayroll").with_public_initializer(admin, initializer_call);

    (env, contract_address, admin, eu_oracle, us_oracle, sg_oracle)
}
