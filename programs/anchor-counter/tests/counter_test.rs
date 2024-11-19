use anchor_lang::{
    prelude::Pubkey,
    solana_program::{self},
    system_program, AccountDeserialize, InstructionData, ToAccountMetas,
};
use anyhow::Ok;
use solana_program::instruction::Instruction;
use solana_program_test::{tokio, ProgramTest, ProgramTestContext};
use solana_sdk::{account::Account, signature::Keypair, signer::Signer, transaction::Transaction};

#[tokio::test]
async fn test_initialize() {
    let mut test_suite = SetUpTest::new().await;
    test_suite.initialize().await.unwrap();

    let counter: anchor_counter::Counter = test_suite.load_and_deserialize().await;

    assert_eq!(counter.count, 0);
}

#[tokio::test]
async fn test_increment() {
    let mut test_suite = SetUpTest::new().await;
    test_suite.initialize().await.unwrap();

    test_suite.increment().await.unwrap();

    let counter: anchor_counter::Counter = test_suite.load_and_deserialize().await;

    assert_eq!(counter.count, 1);
}

#[tokio::test]
async fn test_double_increment() -> anyhow::Result<()> {
    let mut test_suite = SetUpTest::new().await;
    test_suite.initialize().await.unwrap();

    test_suite.increment().await.unwrap();
    test_suite.increment().await.unwrap();

    let counter: anchor_counter::Counter = test_suite.load_and_deserialize().await;

    assert_eq!(counter.count, 2);

    Ok(())
}

#[tokio::test]
async fn test_bogus_counter_acct() -> anyhow::Result<()> {
    let mut test_suite = SetUpTest::new().await;
    test_suite.initialize().await.unwrap();

    let (bogus_pda, _) = Pubkey::find_program_address(&[b"counter_bad"], &anchor_counter::ID);

    let increment_ix = Instruction {
        program_id: anchor_counter::ID,
        accounts: anchor_counter::accounts::Increment {
            counter: bogus_pda,
            user: test_suite.user.pubkey(),
        }
        .to_account_metas(None),
        data: anchor_counter::instruction::Increment {}.data(),
    };

    let increment_tx = Transaction::new_signed_with_payer(
        &[increment_ix],
        Some(&test_suite.user.pubkey()),
        &[&test_suite.user],
        test_suite.ctx.last_blockhash,
    );

    let res = test_suite
        .ctx
        .banks_client
        .process_transaction(increment_tx)
        .await;

    assert!(res.is_err());

    Ok(())
}

/// Struct set up to hold the validator, an optional user account, and the counter PDA.
/// Use SetUpTest::new() to create a new instance.
pub struct SetUpTest {
    pub ctx: ProgramTestContext,
    pub user: Keypair,
    pub counter_pda: Pubkey,
}

/// Returns the validator, an optional funded user account, and the counter PDA
impl SetUpTest {
    pub async fn new() -> Self {
        //Both of these work

        // let mut validator = ProgramTest::default();
        // validator.add_program("anchor_counter", anchor_counter::ID, None);
        let mut validator = ProgramTest::new("anchor_counter", anchor_counter::ID, None);

        //create a new user and fund with 1 SOL
        //add the user to the validator / ledger
        let user = Keypair::new();
        validator.add_account(
            user.pubkey(),
            Account {
                lamports: 1_000_000_000,
                ..Account::default()
            },
        );

        //get the counter PDA -- uses the same seed we used in the anchor program
        let (counter_pda, _) = Pubkey::find_program_address(&[b"counter"], &anchor_counter::ID);
        let ctx = validator.start_with_context().await;
        Self {
            ctx,
            user,
            counter_pda,
        }
    }

    pub async fn process_transaction(&mut self, intructions: &[Instruction]) -> anyhow::Result<()> {
        let init_tx = Transaction::new_signed_with_payer(
            intructions,
            Some(&self.ctx.payer.pubkey()),
            &[&self.ctx.payer],
            self.ctx.last_blockhash,
        );

        self.ctx.banks_client.process_transaction(init_tx).await?;

        // move to next block
        self.ctx.warp_forward_force_reward_interval_end()?;

        Ok(())
    }

    ///Function that initializes the counter account
    ///Useful for testing things you want to fail but need to initialize the counter account first
    pub async fn initialize(&mut self) -> anyhow::Result<()> {
        let init_ix = Instruction {
            program_id: anchor_counter::ID,
            accounts: anchor_counter::accounts::Initialize {
                counter: self.counter_pda,
                user: self.ctx.payer.pubkey(),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
            data: anchor_counter::instruction::Initialize {}.data(),
        };

        self.process_transaction(&[init_ix]).await
    }

    pub async fn increment(&mut self) -> anyhow::Result<()> {
        let increment_ix = Instruction {
            program_id: anchor_counter::ID,
            accounts: anchor_counter::accounts::Increment {
                counter: self.counter_pda,
                user: self.ctx.payer.pubkey(),
            }
            .to_account_metas(None),
            data: anchor_counter::instruction::Increment {}.data(),
        };

        self.process_transaction(&[increment_ix]).await
    }

    /// Fetch the account from the ProgramTestContext and deserialize it.
    /// Taken from the MarginFi Github tests: https://github.com/mrgnlabs/marginfi-v2/blob/main/test-utils/src/test.rs#L468
    pub async fn load_and_deserialize<T: AccountDeserialize>(&mut self) -> T {
        let account = self
            .ctx
            .banks_client
            .get_account(self.counter_pda)
            .await
            .unwrap() //unwraps the Result into an Option<Account>
            .unwrap(); //unwraps the Option<Account> into an Account

        T::try_deserialize(&mut account.data.as_slice()).unwrap()
    }
}
