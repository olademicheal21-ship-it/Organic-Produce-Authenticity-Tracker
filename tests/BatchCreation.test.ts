import { describe, expect, it, vi, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface Batch {
  farmId: number;
  owner: string;
  produceType: string;
  harvestDate: number;
  batchHash: Uint8Array;
  metadata: string;
  organicPractices: string[];
  creationTimestamp: number;
  lastUpdated: number;
  active: boolean;
}

interface BatchVersion {
  updatedHash: Uint8Array;
  versionNotes: string;
  timestamp: number;
}

interface OwnershipTransfer {
  oldOwner: string;
  newOwner: string;
  timestamp: number;
}

interface ContractState {
  batches: Map<number, Batch>;
  batchVersions: Map<string, BatchVersion>;
  batchOwnershipHistory: Map<string, OwnershipTransfer>;
  contractOwner: string;
  paused: boolean;
  batchCounter: number;
}

// Mock contract implementation
class BatchCreationMock {
  private state: ContractState = {
    batches: new Map(),
    batchVersions: new Map(),
    batchOwnershipHistory: new Map(),
    contractOwner: "deployer",
    paused: false,
    batchCounter: 0,
  };

  private ERR_UNAUTHORIZED = 200;
  private ERR_INVALID_INPUT = 201;
  private ERR_FARM_NOT_FOUND = 202;
  private ERR_INACTIVE_FARM = 203;
  private ERR_PAUSED = 204;
  private ERR_ALREADY_REGISTERED = 205;
  private ERR_INVALID_HASH = 206;
  private ERR_BATCH_NOT_FOUND = 207;
  private ERR_INVALID_VERSION = 208;
  private MAX_METADATA_LEN = 500;
  private MAX_PRODUCE_TYPE_LEN = 50;

  // Mock FarmRegistry dependency
  private farmRegistryMock: Map<number, { active: boolean }> = new Map([
    [1, { active: true }],
    [2, { active: false }],
  ]);

  getBatchDetails(batchId: number): ClarityResponse<Batch | null> {
    return { ok: true, value: this.state.batches.get(batchId) ?? null };
  }

  getBatchVersion(batchId: number, version: number): ClarityResponse<BatchVersion | null> {
    return { ok: true, value: this.state.batchVersions.get(`${batchId}-${version}`) ?? null };
  }

  getBatchOwnershipTransfer(batchId: number, transferId: number): ClarityResponse<OwnershipTransfer | null> {
    return { ok: true, value: this.state.batchOwnershipHistory.get(`${batchId}-${transferId}`) ?? null };
  }

  isBatchActive(batchId: number): ClarityResponse<boolean> {
    const batch = this.state.batches.get(batchId);
    return { ok: true, value: batch ? batch.active : false };
  }

  getContractOwner(): ClarityResponse<string> {
    return { ok: true, value: this.state.contractOwner };
  }

  isPaused(): ClarityResponse<boolean> {
    return { ok: true, value: this.state.paused };
  }

  createBatch(
    caller: string,
    farmId: number,
    produceType: string,
    harvestDate: number,
    batchHash: Uint8Array,
    metadata: string,
    organicPractices: string[]
  ): ClarityResponse<number> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (!this.farmRegistryMock.has(farmId)) {
      return { ok: false, value: this.ERR_FARM_NOT_FOUND };
    }
    if (!this.farmRegistryMock.get(farmId)!.active) {
      return { ok: false, value: this.ERR_INACTIVE_FARM };
    }
    if (
      produceType.length > this.MAX_PRODUCE_TYPE_LEN ||
      metadata.length > this.MAX_METADATA_LEN ||
      batchHash.length === 0 ||
      organicPractices.length > 10 ||
      organicPractices.some((p) => p.length === 0 || p.length > 100)
    ) {
      return { ok: false, value: this.ERR_INVALID_INPUT };
    }
    const batchId = this.state.batchCounter + 1;
    this.state.batches.set(batchId, {
      farmId,
      owner: caller,
      produceType,
      harvestDate,
      batchHash,
      metadata,
      organicPractices,
      creationTimestamp: Date.now(),
      lastUpdated: Date.now(),
      active: true,
    });
    this.state.batchCounter = batchId;
    return { ok: true, value: batchId };
  }

  updateBatch(
    caller: string,
    batchId: number,
    newProduceType: string | null,
    newHarvestDate: number | null,
    newBatchHash: Uint8Array | null,
    newMetadata: string | null,
    newPractices: string[] | null,
    versionNotes: string,
    version: number
  ): ClarityResponse<boolean> {
    const batch = this.state.batches.get(batchId);
    if (!batch) {
      return { ok: false, value: this.ERR_BATCH_NOT_FOUND };
    }
    if (batch.owner !== caller) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (!batch.active) {
      return { ok: false, value: this.ERR_INACTIVE_FARM };
    }
    if (
      (newProduceType && newProduceType.length > this.MAX_PRODUCE_TYPE_LEN) ||
      (newMetadata && newMetadata.length > this.MAX_METADATA_LEN) ||
      (newPractices && (newPractices.length > 10 || newPractices.some((p) => p.length === 0 || p.length > 100))) ||
      (newBatchHash && newBatchHash.length === 0) ||
      versionNotes.length > 200
    ) {
      return { ok: false, value: this.ERR_INVALID_INPUT };
    }
    this.state.batches.set(batchId, {
      ...batch,
      produceType: newProduceType ?? batch.produceType,
      harvestDate: newHarvestDate ?? batch.harvestDate,
      batchHash: newBatchHash ?? batch.batchHash,
      metadata: newMetadata ?? batch.metadata,
      organicPractices: newPractices ?? batch.organicPractices,
      lastUpdated: Date.now(),
    });
    this.state.batchVersions.set(`${batchId}-${version}`, {
      updatedHash: newBatchHash ?? batch.batchHash,
      versionNotes,
      timestamp: Date.now(),
    });
    return { ok: true, value: true };
  }

  deactivateBatch(caller: string, batchId: number): ClarityResponse<boolean> {
    const batch = this.state.batches.get(batchId);
    if (!batch) {
      return { ok: false, value: this.ERR_BATCH_NOT_FOUND };
    }
    if (batch.owner !== caller) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.batches.set(batchId, { ...batch, active: false });
    return { ok: true, value: true };
  }

  transferBatchOwnership(caller: string, batchId: number, newOwner: string, transferId: number): ClarityResponse<boolean> {
    const batch = this.state.batches.get(batchId);
    if (!batch) {
      return { ok: false, value: this.ERR_BATCH_NOT_FOUND };
    }
    if (batch.owner !== caller) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (newOwner === caller) {
      return { ok: false, value: this.ERR_INVALID_INPUT };
    }
    this.state.batches.set(batchId, { ...batch, owner: newOwner, lastUpdated: Date.now() });
    this.state.batchOwnershipHistory.set(`${batchId}-${transferId}`, {
      oldOwner: caller,
      newOwner,
      timestamp: Date.now(),
    });
    return { ok: true, value: true };
  }

  pauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.contractOwner) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.paused = true;
    return { ok: true, value: true };
  }

  unpauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.contractOwner) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.paused = false;
    return { ok: true, value: true };
  }
}

// Test setup
const accounts = {
  deployer: "deployer",
  farmer: "wallet_1",
  user1: "wallet_2",
  user2: "wallet_3",
};

describe("BatchCreation Contract", () => {
  let contract: BatchCreationMock;

  beforeEach(() => {
    contract = new BatchCreationMock();
    vi.resetAllMocks();
  });

  it("should initialize with correct state", () => {
    expect(contract.getContractOwner()).toEqual({ ok: true, value: "deployer" });
    expect(contract.isPaused()).toEqual({ ok: true, value: false });
  });

  it("should create a new batch successfully", () => {
    const batchHash = new Uint8Array(32).fill(1);
    const result = contract.createBatch(
      accounts.farmer,
      1,
      "Apples",
      1625097600,
      batchHash,
      "Organic apples from Orchard X",
      ["No pesticides", "Compost-based"]
    );
    expect(result).toEqual({ ok: true, value: 1 });
    const batch = contract.getBatchDetails(1);
    expect(batch).toEqual({
      ok: true,
      value: expect.objectContaining({
        farmId: 1,
        owner: accounts.farmer,
        produceType: "Apples",
        harvestDate: 1625097600,
        batchHash,
        metadata: "Organic apples from Orchard X",
        organicPractices: ["No pesticides", "Compost-based"],
        active: true,
      }),
    });
  });

  it("should prevent batch creation with invalid farm", () => {
    const batchHash = new Uint8Array(32).fill(1);
    const result = contract.createBatch(
      accounts.farmer,
      999,
      "Apples",
      1625097600,
      batchHash,
      "Organic apples",
      ["No pesticides"]
    );
    expect(result).toEqual({ ok: false, value: 202 });
  });

  it("should prevent batch creation with inactive farm", () => {
    const batchHash = new Uint8Array(32).fill(1);
    const result = contract.createBatch(
      accounts.farmer,
      2,
      "Apples",
      1625097600,
      batchHash,
      "Organic apples",
      ["No pesticides"]
    );
    expect(result).toEqual({ ok: false, value: 203 });
  });

  it("should prevent batch creation with invalid input", () => {
    const batchHash = new Uint8Array(32).fill(1);
    const longMetadata = "a".repeat(501);
    const result = contract.createBatch(
      accounts.farmer,
      1,
      "Apples",
      1625097600,
      batchHash,
      longMetadata,
      ["No pesticides"]
    );
    expect(result).toEqual({ ok: false, value: 201 });
  });

  it("should update batch details successfully", () => {
    const batchHash = new Uint8Array(32).fill(1);
    contract.createBatch(
      accounts.farmer,
      1,
      "Apples",
      1625097600,
      batchHash,
      "Organic apples",
      ["No pesticides"]
    );
    const newBatchHash = new Uint8Array(32).fill(2);
    const result = contract.updateBatch(
      accounts.farmer,
      1,
      "Golden Apples",
      1625184000,
      newBatchHash,
      "Updated organic apples",
      ["No pesticides", "Organic compost"],
      "Updated variety and practices",
      1
    );
    expect(result).toEqual({ ok: true, value: true });
    const batch = contract.getBatchDetails(1);
    expect(batch).toEqual({
      ok: true,
      value: expect.objectContaining({
        produceType: "Golden Apples",
        harvestDate: 1625184000,
        batchHash: newBatchHash,
        metadata: "Updated organic apples",
        organicPractices: ["No pesticides", "Organic compost"],
      }),
    });
    const version = contract.getBatchVersion(1, 1);
    expect(version).toEqual({
      ok: true,
      value: expect.objectContaining({
        updatedHash: newBatchHash,
        versionNotes: "Updated variety and practices",
      }),
    });
  });

  it("should prevent unauthorized batch update", () => {
    const batchHash = new Uint8Array(32).fill(1);
    contract.createBatch(
      accounts.farmer,
      1,
      "Apples",
      1625097600,
      batchHash,
      "Organic apples",
      ["No pesticides"]
    );
    const result = contract.updateBatch(
      accounts.user1,
      1,
      "Golden Apples",
      null,
      null,
      null,
      null,
      "Unauthorized update",
      1
    );
    expect(result).toEqual({ ok: false, value: 200 });
  });

  it("should deactivate batch successfully", () => {
    const batchHash = new Uint8Array(32).fill(1);
    contract.createBatch(
      accounts.farmer,
      1,
      "Apples",
      1625097600,
      batchHash,
      "Organic apples",
      ["No pesticides"]
    );
    const result = contract.deactivateBatch(accounts.farmer, 1);
    expect(result).toEqual({ ok: true, value: true });
    expect(contract.isBatchActive(1)).toEqual({ ok: true, value: false });
  });

  it("should transfer batch ownership successfully", () => {
    const batchHash = new Uint8Array(32).fill(1);
    contract.createBatch(
      accounts.farmer,
      1,
      "Apples",
      1625097600,
      batchHash,
      "Organic apples",
      ["No pesticides"]
    );
    const result = contract.transferBatchOwnership(accounts.farmer, 1, accounts.user1, 1);
    expect(result).toEqual({ ok: true, value: true });
    const batch = contract.getBatchDetails(1);
    expect(batch).toEqual({ ok: true, value: expect.objectContaining({ owner: accounts.user1 }) });
    const transfer = contract.getBatchOwnershipTransfer(1, 1);
    expect(transfer).toEqual({
      ok: true,
      value: expect.objectContaining({
        oldOwner: accounts.farmer,
        newOwner: accounts.user1,
      }),
    });
  });

  it("should pause and unpause contract", () => {
    const pauseResult = contract.pauseContract(accounts.deployer);
    expect(pauseResult).toEqual({ ok: true, value: true });
    expect(contract.isPaused()).toEqual({ ok: true, value: true });

    const batchHash = new Uint8Array(32).fill(1);
    const createDuringPause = contract.createBatch(
      accounts.farmer,
      1,
      "Apples",
      1625097600,
      batchHash,
      "Organic apples",
      ["No pesticides"]
    );
    expect(createDuringPause).toEqual({ ok: false, value: 204 });

    const unpauseResult = contract.unpauseContract(accounts.deployer);
    expect(unpauseResult).toEqual({ ok: true, value: true });
    expect(contract.isPaused()).toEqual({ ok: true, value: false });
  });
});