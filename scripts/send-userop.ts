import {
  createWalletClient,
  createPublicClient,
  encodeFunctionData,
  encodeAbiParameters,
  keccak256,
  http,
  parseAbi,
  parseEther,
  toBytes,
  pad,
  parseAbiParameters,
  toHex,
  getAddress,
  concat,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import fs from 'fs';
import path from 'path';

export type UserOperation = {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  accountGasLimits: Hex; // bytes32 packed
  preVerificationGas: bigint;
  gasFees: Hex; // bytes32 packed
  paymasterAndData: Hex;
  signature: Hex;
};

const ENTRYPOINT_ADDRESS = '0x64e4476B8a75E66FA31c198b702a3C6784CEf29e'; // '0x0576a174D229E3cFA37253523E645A78A0C91B57';
const AA_ADDRESS = '0xf244D7d836E232E6CF337070be635245E6a67Da0';
const RECEIVER = '0xF565371679083ED779F9Ef6bdeA7Bd29a6D6EEAE';
const OWNER_PRIVATE_KEY = process.env.PRIVATE_KEY; // Replace with your AA owner private key

const owner = privateKeyToAccount(OWNER_PRIVATE_KEY);

const client = createWalletClient({
  account: owner,
  chain: sepolia,
  transport: http(),
});

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

// Load ABIs from artifacts
const abstractAccountArtifact = JSON.parse(
  fs.readFileSync(
    path.resolve('./artifacts/contracts/AbstractAccount.sol/AbstractAccount.json'),
    'utf-8'
  )
);
const AA_ABI = abstractAccountArtifact.abi;

const entryPointArtifact = JSON.parse(
  fs.readFileSync(
    path.resolve('./artifacts/contracts/EntryPoint.sol/EntryPoint.json'),
    'utf-8'
  )
);
const ENTRYPOINT_ABI = entryPointArtifact.abi;

async function main() {
  // 1. Fetch the current nonce for the AA
  const nonce = await publicClient.readContract({
    address: ENTRYPOINT_ADDRESS,
    abi: ENTRYPOINT_ABI,
    functionName: 'getNonce',
    args: [AA_ADDRESS, 0n],
  });

  // 2. Encode the AA's execute() call data (send 0.001 ETH with empty calldata)

function pack128Pair(a: bigint, b: bigint): `0x${string}` {
  return `0x${(a << 128n | b).toString(16).padStart(64, '0')}`;
}

const callGasLimit = 100_000n
const verificationGasLimit = 100_000n
const maxFeePerGas = 2_000_000_000n
const maxPriorityFeePerGas = 1_000_000_000n

const accountGasLimits = pack128Pair(callGasLimit, verificationGasLimit);
const gasFees = pack128Pair(maxFeePerGas, maxPriorityFeePerGas);

const callData = encodeFunctionData({
  abi: AA_ABI,
  functionName: 'execute',
  args: [
    RECEIVER,
    parseEther('0.0001'),
    '0x',
  ],
});

const preVerificationGas = 21000n

  // 3. Build the unsigned UserOperation object (signature = '0x' placeholder)
const userOp = {
  sender: AA_ADDRESS,
  nonce: BigInt(nonce),
  initCode: '0x',
  callData,
  accountGasLimits,
  preVerificationGas,
  gasFees,
  paymasterAndData: '0x',
  signature: '0x',
};

console.log('userOp', userOp);

  // 4. Define the UserOperation tuple[] type exactly matching your Solidity struct
const userOpAbiParam = [
  {
    name: 'ops',
    type: 'tuple',
    components: [
      { name: 'sender', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'initCode', type: 'bytes' },
      { name: 'callData', type: 'bytes' },
      { name: 'accountGasLimits', type: 'bytes32' },
      { name: 'preVerificationGas', type: 'uint256' },
      { name: 'gasFees', type: 'bytes32' },
      { name: 'paymasterAndData', type: 'bytes' },
      { name: 'signature', type: 'bytes' },
    ] as const,
  },
];

  // 5. Encode and hash the UserOperation array with empty signature

const userOpAbiComponents = [
  { name: 'sender', type: 'address' },
  { name: 'nonce', type: 'uint256' },
  { name: 'initCode', type: 'bytes' },
  { name: 'callData', type: 'bytes' },
  { name: 'accountGasLimits', type: 'bytes32' },
  { name: 'preVerificationGas', type: 'uint256' },
  { name: 'gasFees', type: 'bytes32' },
  { name: 'paymasterAndData', type: 'bytes' },
  { name: 'signature', type: 'bytes' },
] as const;

const encodedUserOp = encodeAbiParameters(
  [
    {
      name: 'userOp',
      type: 'tuple',
      components: userOpAbiComponents,
    },
  ],
  [
    userOp,
  ]
);

const chainId = await publicClient.getChainId(); // e.g., 11155111 for Sepolia
const entryPoint = ENTRYPOINT_ADDRESS;  
console.log('encodedUserOp', encodedUserOp)

const userOpHash = keccak256(
  concat([
    keccak256(encodedUserOp),
    pad(entryPoint, 32),
    pad(toHex(chainId), 32),
  ])
);


  console.log('userOpHash', userOpHash)

  // 6. Sign the userOpHash with the owner's private key
  const sig = await owner.signMessage({ message: { raw: userOpHash } });
  console.log('sig', sig) 

  // 7. Extract r,s,v from signature and encode to bytes for your AA recover()
  const r = `0x${sig.slice(2, 66)}`;
  const s = `0x${sig.slice(66, 130)}`;
  const v = parseInt(sig.slice(130, 132), 16);

  const finalSignature = encodeAbiParameters(
    [
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
    ],
    [r, s, v],
  );
  console.log('finalSignature, finalSignature')
  // 8. Construct the final UserOperation with real signature
  const signedUserOp = { ...userOp, signature: finalSignature };
  console.log('signedUserOp', signedUserOp)
  console.log('owner' + owner)
  console.log(ENTRYPOINT_ADDRESS)

  // 9. Send handleOps to EntryPoint with single UserOperation
  const txHash = await client.writeContract({
    address: ENTRYPOINT_ADDRESS,
    abi: ENTRYPOINT_ABI,
    functionName: 'handleOps',
    args: [[signedUserOp], owner.address],
  });

  console.log('handleOps tx sent:', txHash);
}

main().catch(console.error);

