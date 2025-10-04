import { describe, it, expect, beforeEach } from "vitest";
import { uintCV, principalCV, bufferCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_PROPOSAL_ID = 101;
const ERR_INVALID_MILESTONE_ID = 102;
const ERR_INVALID_AMOUNT = 103;
const ERR_INVALID_WEIGHT = 104;
const ERR_INVALID_RECIPIENT = 105;
const ERR_PROPOSAL_NOT_FOUND = 106;
const ERR_MILESTONE_NOT_FOUND = 107;
const ERR_MILESTONE_ALREADY_COMPLETED = 108;
const ERR_INSUFFICIENT_ESCROW = 109;
const ERR_VERIFICATION_FAILED = 110;
const ERR_INVALID_BATCH_SIZE = 112;
const ERR_ESCROW_NOT_SET = 115;
const ERR_ORACLE_NOT_SET = 116;
const ERR_MAX_DISBURSEMENTS_EXCEEDED = 119;
const ERR_INVALID_PENALTY = 120;
const ERR_INVALID_INTEREST = 121;
const ERR_INVALID_GRACE_PERIOD = 122;

interface Proposal {
  totalFunds: bigint;
  disbursedFunds: bigint;
  milestoneCount: bigint;
  recipient: string;
  status: boolean;
  timestamp: bigint;
  penaltyRate: bigint;
  interestRate: bigint;
  gracePeriod: bigint;
}

interface Milestone {
  weight: bigint;
  amount: bigint;
  completed: boolean;
  verified: boolean;
  timestamp: bigint;
  proofHash: Buffer;
}

interface Disbursement {
  proposalId: bigint;
  milestoneId: bigint;
  amount: bigint;
  recipient: string;
  timestamp: bigint;
  status: boolean;
}

interface Result<T, E> {
  ok: boolean;
  value: T | E;
}

class DisbursementEngineMock {
  state: {
    nextDisbursementId: bigint;
    maxDisbursements: bigint;
    disbursementFee: bigint;
    escrowContract: string | null;
    oracleContract: string | null;
    trackerContract: string | null;
    adminPrincipal: string;
    proposals: Map<bigint, Proposal>;
    milestones: Map<string, Milestone>;
    disbursements: Map<bigint, Disbursement>;
  } = {
    nextDisbursementId: 0n,
    maxDisbursements: 5000n,
    disbursementFee: 500n,
    escrowContract: null,
    oracleContract: null,
    trackerContract: null,
    adminPrincipal: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
    proposals: new Map(),
    milestones: new Map(),
    disbursements: new Map(),
  };
  blockHeight: bigint = 0n;
  caller: string = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
  stxTransfers: Array<{ amount: bigint; from: string; to: string }> = [];
  contractCalls: Array<{ contract: string; method: string; args: any[]; result: any }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextDisbursementId: 0n,
      maxDisbursements: 5000n,
      disbursementFee: 500n,
      escrowContract: null,
      oracleContract: null,
      trackerContract: null,
      adminPrincipal: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      proposals: new Map(),
      milestones: new Map(),
      disbursements: new Map(),
    };
    this.blockHeight = 0n;
    this.caller = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    this.stxTransfers = [];
    this.contractCalls = [];
  }

  mockContractCall(contract: string, method: string, args: any[], result: any) {
    this.contractCalls.push({ contract, method, args, result });
  }

  setEscrowContract(contract: string): Result<boolean, number> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.escrowContract = contract;
    return { ok: true, value: true };
  }

  setOracleContract(contract: string): Result<boolean, number> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.oracleContract = contract;
    return { ok: true, value: true };
  }

  setTrackerContract(contract: string): Result<boolean, number> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.trackerContract = contract;
    return { ok: true, value: true };
  }

  setMaxDisbursements(newMax: bigint): Result<boolean, number> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newMax <= 0n) return { ok: false, value: ERR_INVALID_AMOUNT };
    this.state.maxDisbursements = newMax;
    return { ok: true, value: true };
  }

  setDisbursementFee(newFee: bigint): Result<boolean, number> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newFee < 0n) return { ok: false, value: ERR_INVALID_AMOUNT };
    this.state.disbursementFee = newFee;
    return { ok: true, value: true };
  }

  registerProposal(
    totalFunds: bigint,
    milestoneCount: bigint,
    recipient: string,
    penaltyRate: bigint,
    interestRate: bigint,
    gracePeriod: bigint
  ): Result<bigint, number> {
    const nextId = this.state.nextDisbursementId + 1n;
    if (nextId >= this.state.maxDisbursements) return { ok: false, value: ERR_MAX_DISBURSEMENTS_EXCEEDED };
    if (totalFunds <= 0n) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (recipient === this.caller) return { ok: false, value: ERR_INVALID_RECIPIENT };
    if (penaltyRate > 50n) return { ok: false, value: ERR_INVALID_PENALTY };
    if (interestRate > 15n) return { ok: false, value: ERR_INVALID_INTEREST };
    if (gracePeriod > 60n) return { ok: false, value: ERR_INVALID_GRACE_PERIOD };
    this.state.proposals.set(nextId, {
      totalFunds,
      disbursedFunds: 0n,
      milestoneCount,
      recipient,
      status: true,
      timestamp: this.blockHeight,
      penaltyRate,
      interestRate,
      gracePeriod,
    });
    this.state.nextDisbursementId = nextId;
    return { ok: true, value: nextId };
  }

  addMilestone(
    proposalId: bigint,
    milestoneId: bigint,
    weight: bigint,
    amount: bigint,
    proofHash: Buffer
  ): Result<boolean, number> {
    const proposal = this.state.proposals.get(proposalId);
    if (!proposal) return { ok: false, value: ERR_PROPOSAL_NOT_FOUND };
    if (this.caller !== proposal.recipient) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (proposalId <= 0n) return { ok: false, value: ERR_INVALID_PROPOSAL_ID };
    if (milestoneId <= 0n) return { ok: false, value: ERR_INVALID_MILESTONE_ID };
    if (weight <= 0n || weight > 100n) return { ok: false, value: ERR_INVALID_WEIGHT };
    if (amount <= 0n) return { ok: false, value: ERR_INVALID_AMOUNT };
    const key = `${proposalId}-${milestoneId}`;
    if (this.state.milestones.has(key)) return { ok: false, value: ERR_MILESTONE_ALREADY_COMPLETED };
    this.state.milestones.set(key, {
      weight,
      amount,
      completed: false,
      verified: false,
      timestamp: this.blockHeight,
      proofHash,
    });
    return { ok: true, value: true };
  }

  verifyMilestone(proposalId: bigint, milestoneId: bigint): Result<boolean, number> {
    const proposal = this.state.proposals.get(proposalId);
    if (!proposal) return { ok: false, value: ERR_PROPOSAL_NOT_FOUND };
    const key = `${proposalId}-${milestoneId}`;
    const milestone = this.state.milestones.get(key);
    if (!milestone) return { ok: false, value: ERR_MILESTONE_NOT_FOUND };
    if (milestone.completed) return { ok: false, value: ERR_MILESTONE_ALREADY_COMPLETED };
    if (!this.state.oracleContract) return { ok: false, value: ERR_ORACLE_NOT_SET };
    const oracleCall = this.contractCalls.find(
      c => c.contract === this.state.oracleContract && c.method === "verify-proof" && c.args[0].toString('hex') === milestone.proofHash.toString('hex')
    );
    if (!oracleCall || !oracleCall.result) return { ok: false, value: ERR_VERIFICATION_FAILED };
    this.state.milestones.set(key, { ...milestone, verified: true, timestamp: this.blockHeight });
    return { ok: true, value: true };
  }

  disburseFunds(proposalId: bigint, milestoneId: bigint): Result<bigint, number> {
    const proposal = this.state.proposals.get(proposalId);
    if (!proposal) return { ok: false, value: ERR_PROPOSAL_NOT_FOUND };
    const key = `${proposalId}-${milestoneId}`;
    const milestone = this.state.milestones.get(key);
    if (!milestone) return { ok: false, value: ERR_MILESTONE_NOT_FOUND };
    if (!milestone.verified) return { ok: false, value: ERR_VERIFICATION_FAILED };
    if (milestone.completed) return { ok: false, value: ERR_MILESTONE_ALREADY_COMPLETED };
    if (!this.state.escrowContract) return { ok: false, value: ERR_ESCROW_NOT_SET };
    const escrowCall = this.contractCalls.find(
      c => c.contract === this.state.escrowContract && c.method === "get-balance" && c.args[0] === proposalId
    );
    if (!escrowCall || escrowCall.result < milestone.amount) return { ok: false, value: ERR_INSUFFICIENT_ESCROW };
    const nextId = this.state.nextDisbursementId;
    const amount = milestone.amount;
    const fee = this.state.disbursementFee;
    this.stxTransfers.push({ amount: fee, from: this.caller, to: this.state.adminPrincipal });
    this.state.milestones.set(key, { ...milestone, completed: true, timestamp: this.blockHeight });
    this.state.proposals.set(proposalId, {
      ...proposal,
      disbursedFunds: proposal.disbursedFunds + amount,
    });
    this.state.disbursements.set(nextId, {
      proposalId,
      milestoneId,
      amount,
      recipient: proposal.recipient,
      timestamp: this.blockHeight,
      status: true,
    });
    this.state.nextDisbursementId += 1n;
    return { ok: true, value: nextId };
  }

  batchDisburse(proposalId: bigint, milestoneIds: bigint[]): Result<bigint, number> {
    const size = BigInt(milestoneIds.length);
    if (size <= 0n || size > 10n) return { ok: false, value: ERR_INVALID_BATCH_SIZE };
    let count = 0n;
    for (const id of milestoneIds) {
      const result = this.disburseFunds(proposalId, id);
      if (!result.ok) return { ok: false, value: result.value as number };
      count += 1n;
    }
    return { ok: true, value: count };
  }

  getProposal(id: bigint): Proposal | undefined {
    return this.state.proposals.get(id);
  }

  getMilestone(proposalId: bigint, milestoneId: bigint): Milestone | undefined {
    const key = `${proposalId}-${milestoneId}`;
    return this.state.milestones.get(key);
  }

  getDisbursement(id: bigint): Disbursement | undefined {
    return this.state.disbursements.get(id);
  }
}

describe("DisbursementEngine", () => {
  let contract: DisbursementEngineMock;

  beforeEach(() => {
    contract = new DisbursementEngineMock();
    contract.reset();
  });

  it("registers a proposal successfully", () => {
    const result = contract.registerProposal(10000n, 5n, "ST2SJ3D0K5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5", 10n, 5n, 30n);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(1n);
    const proposal = contract.getProposal(1n);
    expect(proposal?.totalFunds).toBe(10000n);
    expect(proposal?.milestoneCount).toBe(5n);
    expect(proposal?.recipient).toBe("ST2SJ3D0K5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5");
    expect(proposal?.penaltyRate).toBe(10n);
    expect(proposal?.interestRate).toBe(5n);
    expect(proposal?.gracePeriod).toBe(30n);
  });

  it("rejects invalid proposal registration", () => {
    const result = contract.registerProposal(0n, 5n, "ST2SJ3D0K5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5", 10n, 5n, 30n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_AMOUNT);
  });

  it("adds a milestone successfully", () => {
    contract.registerProposal(10000n, 5n, "ST2SJ3D0K5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5", 10n, 5n, 30n);
    contract.caller = "ST2SJ3D0K5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5";
    const proofHash = Buffer.from("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", 'hex');
    const result = contract.addMilestone(1n, 1n, 20n, 2000n, proofHash);
    expect(result.ok).toBe(true);
    const milestone = contract.getMilestone(1n, 1n);
    expect(milestone?.weight).toBe(20n);
    expect(milestone?.amount).toBe(2000n);
    expect(milestone?.completed).toBe(false);
    expect(milestone?.verified).toBe(false);
  });

  it("rejects unauthorized milestone addition", () => {
    contract.registerProposal(10000n, 5n, "ST2SJ3D0K5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5", 10n, 5n, 30n);
    const proofHash = Buffer.from("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", 'hex');
    const result = contract.addMilestone(1n, 1n, 20n, 2000n, proofHash);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("verifies a milestone successfully", () => {
    contract.setOracleContract("ST3ORACLE");
    contract.registerProposal(10000n, 5n, "ST2SJ3D0K5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5", 10n, 5n, 30n);
    contract.caller = "ST2SJ3D0K5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5";
    const proofHash = Buffer.from("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", 'hex');
    contract.addMilestone(1n, 1n, 20n, 2000n, proofHash);
    contract.mockContractCall("ST3ORACLE", "verify-proof", [proofHash], true);
    const result = contract.verifyMilestone(1n, 1n);
    expect(result.ok).toBe(true);
    const milestone = contract.getMilestone(1n, 1n);
    expect(milestone?.verified).toBe(true);
  });

  it("rejects verification without oracle", () => {
    contract.registerProposal(10000n, 5n, "ST2SJ3D0K5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5", 10n, 5n, 30n);
    contract.caller = "ST2SJ3D0K5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5";
    const proofHash = Buffer.from("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", 'hex');
    contract.addMilestone(1n, 1n, 20n, 2000n, proofHash);
    const result = contract.verifyMilestone(1n, 1n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ORACLE_NOT_SET);
  });

  it("rejects disbursement without escrow", () => {
    contract.setOracleContract("ST3ORACLE");
    contract.registerProposal(10000n, 5n, "ST2SJ3D0K5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5", 10n, 5n, 30n);
    contract.caller = "ST2SJ3D0K5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5";
    const proofHash = Buffer.from("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", 'hex');
    contract.addMilestone(1n, 1n, 20n, 2000n, proofHash);
    contract.mockContractCall("ST3ORACLE", "verify-proof", [proofHash], true);
    contract.verifyMilestone(1n, 1n);
    const result = contract.disburseFunds(1n, 1n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ESCROW_NOT_SET);
  });

  it("performs batch disbursement successfully", () => {
    contract.setEscrowContract("ST4ESCROW");
    contract.setOracleContract("ST3ORACLE");
    contract.registerProposal(10000n, 2n, "ST2SJ3D0K5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5", 10n, 5n, 30n);
    contract.caller = "ST2SJ3D0K5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5D8Z9Z5";
    const proofHash1 = Buffer.from("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", 'hex');
    const proofHash2 = Buffer.from("abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", 'hex');
    contract.addMilestone(1n, 1n, 20n, 2000n, proofHash1);
    contract.addMilestone(1n, 2n, 30n, 3000n, proofHash2);
    contract.mockContractCall("ST3ORACLE", "verify-proof", [proofHash1], true);
    contract.mockContractCall("ST3ORACLE", "verify-proof", [proofHash2], true);
    contract.verifyMilestone(1n, 1n);
    contract.verifyMilestone(1n, 2n);
    contract.mockContractCall("ST4ESCROW", "get-balance", [1n], 5000n);
    const result = contract.batchDisburse(1n, [1n, 2n]);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2n);
    const proposal = contract.getProposal(1n);
    expect(proposal?.disbursedFunds).toBe(5000n);
  });

  it("rejects invalid batch size", () => {
    const result = contract.batchDisburse(1n, []);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_BATCH_SIZE);
  });

  it("sets disbursement fee successfully", () => {
    const result = contract.setDisbursementFee(1000n);
    expect(result.ok).toBe(true);
    expect(contract.state.disbursementFee).toBe(1000n);
  });

  it("rejects unauthorized fee change", () => {
    contract.caller = "ST5FAKE";
    const result = contract.setDisbursementFee(1000n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });
});