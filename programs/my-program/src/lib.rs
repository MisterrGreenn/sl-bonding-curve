use anchor_lang::prelude::*;

declare_id!("BManGV3uwhHypt6FDZsHcdQHDsUZDLCYSfCEQ1j81xFu");

#[program]
pub mod my_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
