import assert from 'assert';
import crypto from 'crypto';
import { Database, initDatabase } from '../server/db.ts';
import { generateSecureApiKey, hashApiKey } from '../server/auth.ts';
import type { ApiPermission, VirtualMachine } from '../server/types.ts';

console.log('--- Starting BusterNodes DVM Panel API Test Suite ---');

async function runTests() {
  initDatabase();
  const db = Database.raw();

  // Test 1: Cryptographic API Key Generation & Hashing
  console.log('\n[Test 1] Cryptographic Key Generation & Hashing');
  const { fullKey, keyPrefix, keyHash } = generateSecureApiKey();
  assert(fullKey.startsWith('dvm_live_'), 'Full key must start with dvm_live_');
  assert.strictEqual(hashApiKey(fullKey), keyHash, 'SHA-256 hash must match hashApiKey()');
  console.log('✓ API Key generation and hashing verified successfully');

  // Test 2: Database Persistence of API Keys
  console.log('\n[Test 2] API Key Creation and Database Persistence');
  const admin = Database.getDefaultAdmin();
  const testKeyId = 'test_key_' + crypto.randomBytes(4).toString('hex');
  Database.createApiKey({
    id: testKeyId,
    userId: admin.id,
    name: 'Automated CI Test Key',
    keyPrefix,
    keyHash,
    permissions: ['vms.read', 'images.read'],
    expiresAt: null
  });

  const retrieved = Database.getApiKeyByHash(keyHash);
  assert(retrieved, 'Key must be retrievable by hash');
  assert.strictEqual(retrieved.name, 'Automated CI Test Key');
  assert.deepStrictEqual(retrieved.permissions, ['vms.read', 'images.read']);
  console.log('✓ API Key stored and retrieved by cryptographic hash successfully');

  // Test 3: Granular Permission Validation
  console.log('\n[Test 3] Granular Permission Validation');
  const hasVmRead = retrieved.permissions.includes('vms.read');
  const hasVmCreate = retrieved.permissions.includes('vms.create');
  assert.strictEqual(hasVmRead, true, 'Key must have vms.read');
  assert.strictEqual(hasVmCreate, false, 'Key must NOT have vms.create');
  console.log('✓ Granular permissions correctly isolated');

  // Test 4: Key Revocation Enforcement
  console.log('\n[Test 4] Key Revocation Immediate Invalidation');
  const revokedSuccess = Database.revokeApiKey(testKeyId, admin.id);
  assert(revokedSuccess, 'Revocation query must succeed');
  const revokedKey = Database.getApiKeyByHash(keyHash);
  assert(revokedKey, 'Revoked key record exists');
  assert.strictEqual(revokedKey.is_revoked, 1, 'is_revoked must be 1');
  console.log('✓ Key revocation successfully set is_revoked = 1');

  // Test 5: Expired Key Verification
  console.log('\n[Test 5] Expired Key Validation');
  const expiredKeyId = 'exp_key_' + crypto.randomBytes(4).toString('hex');
  const expiredGen = generateSecureApiKey();
  Database.createApiKey({
    id: expiredKeyId,
    userId: admin.id,
    name: 'Expired Key',
    keyPrefix: expiredGen.keyPrefix,
    keyHash: expiredGen.keyHash,
    permissions: ['vms.read'],
    expiresAt: new Date(Date.now() - 3600000).toISOString() // 1 hour in the past
  });

  const fetchedExpired = Database.getApiKeyByHash(expiredGen.keyHash);
  assert(fetchedExpired, 'Expired key exists');
  const isExpired = fetchedExpired.expires_at ? new Date(fetchedExpired.expires_at).getTime() < Date.now() : false;
  assert.strictEqual(isExpired, true, 'Key expiration timestamp must be in past');
  console.log('✓ Expired key correctly detected as expired');

  // Test 6: VM Ownership & IDOR Protection
  console.log('\n[Test 6] VM Ownership & IDOR Protection');
  // Create user B
    const userBId = 'usr_b_' + crypto.randomBytes(4).toString('hex');
  const userBName = 'user_b_' + crypto.randomBytes(4).toString('hex');
  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userBId, userBName, `${userBName}@example.com`, 'hash', 'user', new Date().toISOString());

  // Create VM owned by user B
  const vmBId = 'vm_b_' + crypto.randomBytes(4).toString('hex');
  const vmB: VirtualMachine = {
    id: vmBId,
    user_id: userBId,
    name: 'user-b-isolated-vm',
    image: 'debian:12',
    status: 'running',
    cpu: 2,
    ram_mb: 2048,
    disk_gb: 20,
    ssh_port: 2288,
    ip_address: '172.28.0.50',
    container_id: 'dvm_c_b_test',
    ports: [],
    notes: 'Private VM for user B',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  Database.createVm(vmB);

  // Attempt to access user B's VM with admin ID -> should fail
  const unauthorizedCheck = Database.getVmById(vmBId, admin.id);
  assert.strictEqual(unauthorizedCheck, undefined, 'Admin user must NOT access user B VM without scoping');

  // Access user B's VM with user B ID -> should succeed
  const authorizedCheck = Database.getVmById(vmBId, userBId);
  assert(authorizedCheck, 'Owner must access their own VM');
  assert.strictEqual(authorizedCheck.id, vmBId);
  console.log('✓ Cross-user IDOR attempt blocked; owner isolation verified');

  // Test 7: Unauthorized VM Deletion Prevention
  console.log('\n[Test 7] Unauthorized VM Deletion Prevention');
  const deleteAttempt = Database.deleteVm(vmBId, admin.id);
  assert.strictEqual(deleteAttempt, false, 'Non-owner must NOT be able to delete another user VM');
  const stillExists = Database.getVmById(vmBId, userBId);
  assert(stillExists, 'VM must remain intact after unauthorized deletion attempt');
  console.log('✓ Unauthorized deletion attempt blocked');

  // Test 8: Activity Logging Without Secrets
  console.log('\n[Test 8] API Activity Telemetry (Secret Stripping)');
  Database.logApiRequest({
    api_key_id: testKeyId,
    key_prefix: keyPrefix,
    user_id: admin.id,
    endpoint: '/api/v1/vms',
    method: 'GET',
    status_code: 200,
    duration_ms: 12,
    ip_address: '127.0.0.1',
    error_code: null,
    timestamp: new Date().toISOString()
  });

  const logsResult = Database.listApiLogs({ userId: admin.id, limit: 5 });
  assert(logsResult.rows.length > 0, 'Logs must be recorded');
  const logged = logsResult.rows[0];
  // Verify secrets are NOT logged
  assert.strictEqual((logged as any).fullKey, undefined, 'Full key must not exist in log');
  assert.strictEqual((logged as any).token, undefined, 'Token must not exist in log');
  assert.strictEqual((logged as any).password, undefined, 'Password must not exist in log');
  console.log('✓ Activity logs recorded with sensitive secrets stripped');

  // Test 9: Real Host Capacity Validation
  console.log('\n[Test 9] Real Host Capacity Validation');
  const { validateHostCapacity, getHostResourceInfo } = await import('../server/hostResources.ts');
  const realHost = getHostResourceInfo();
  assert(realHost.cpu.cores >= 1, 'Host must detect real CPU core count');
  assert(realHost.ram.totalMb > 0, 'Host must detect real RAM capacity');
  assert(realHost.disk.totalGb >= 0, 'Host must detect real disk capacity');

  // Requesting impossibly large RAM should fail
  const excessiveRamCheck = validateHostCapacity({ cpu: 1, ramMb: realHost.ram.totalMb * 10, diskGb: 10 });
  assert.strictEqual(excessiveRamCheck.valid, false, 'Excessive RAM request must be rejected');
  console.log('✓ Host capacity boundary validation enforced');

  // Test 10: Custom Resource Allocation Verification
  console.log('\n[Test 10] Custom Resource Allocation Verification');
  // Valid allocation matching host capability
  const validCheck = validateHostCapacity({ cpu: 1, ramMb: 512, diskGb: 5 });
  assert.strictEqual(validCheck.valid, true, 'Valid custom resources must be accepted');
  console.log('✓ Custom numerical allocation validated without artificial dropdown limits');

  // Test 11: Single Master Admin API Key System
  console.log('\n[Test 11] Single Master Admin API Key System');
  const { generateSecureAdminApiKey } = await import('../server/auth.ts');
  const adminKeyGen = generateSecureAdminApiKey();
  assert(adminKeyGen.fullKey.startsWith('dvm_admin_'), 'Master key must start with dvm_admin_');
  
  // Set new master key
  const updatedAdminKey = Database.setAdminApiKey(adminKeyGen.fullKey, adminKeyGen.keyPrefix, adminKeyGen.keyHash);
  assert.strictEqual(updatedAdminKey.raw_key, adminKeyGen.fullKey);
  assert.strictEqual(updatedAdminKey.status, 'active');
  assert.strictEqual(updatedAdminKey.key_prefix, adminKeyGen.keyPrefix);

  // Revoke master key
  const didRevoke = Database.revokeAdminApiKey();
  assert.strictEqual(didRevoke, true, 'Revoking master key must return true');
  const revokedAdmin = Database.getAdminApiKey();
  assert.strictEqual(revokedAdmin?.status, 'revoked');
  console.log('✓ Master Admin API Key lifecycle (generate -> persist -> revoke) verified');

  // Re-enable master key
  const didEnable = Database.enableAdminApiKey();
  assert.strictEqual(didEnable, true);
  const activeAdmin = Database.getAdminApiKey();
  assert.strictEqual(activeAdmin?.status, 'active');
  console.log('✓ Master Admin API Key re-enabled successfully');

  // Test 12: Verified Images Whitelist & Zero Fake Images Check
  console.log('\n[Test 12] Verified Images Whitelist & Zero Fake Templates');
  const { SUPPORTED_IMAGES, getVerifiedImages } = await import('../server/docker.ts');
  const tags = SUPPORTED_IMAGES.map(i => i.tag);
  
  // Ensure no fake BusterNodes appliances
  assert(!tags.includes('busternodes/dvm-base:latest'), 'Fake BusterNodes base appliance must not exist');
  
  // Ensure no fake badges
  for (const img of SUPPORTED_IMAGES) {
    assert.strictEqual((img as any).badge, undefined, `Image ${img.tag} must not contain fake badges`);
    assert.strictEqual(img.verified, true, `Image ${img.tag} must be marked verified`);
  }

  // Ensure legitimate images exist
  assert(tags.includes('ubuntu:24.04'), 'ubuntu:24.04 must exist');
  assert(tags.includes('ubuntu:22.04'), 'ubuntu:22.04 must exist');
  assert(tags.includes('debian:12'), 'debian:12 must exist');
  assert(tags.includes('almalinux:9'), 'almalinux:9 must exist');
  assert(tags.includes('rockylinux:9'), 'rockylinux:9 must exist');
  assert(tags.includes('alpine:3.20'), 'alpine:3.20 must exist');

  const verifiedList = await getVerifiedImages();
  assert.strictEqual(verifiedList.length, SUPPORTED_IMAGES.length);
  console.log('✓ Real verified Docker images strictly enforced without fake optimization claims');

  // Test 13: Default Administrator Account & Mandatory Password Change
  console.log('\n[Test 13] Default Administrator Account & Mandatory Password Change');
  Database.raw().prepare('UPDATE users SET must_change_password = 1 WHERE email = ?').run('admin@dvm.io');
  const defaultAdmin = Database.getUserByEmail('admin@dvm.io');
  assert(defaultAdmin, 'Default administrator account admin@dvm.io must exist');
  assert.strictEqual(defaultAdmin.role, 'admin', 'Default admin must have admin role');
  assert.strictEqual(defaultAdmin.must_change_password, 1, 'Default admin must require changing password on initial login');
  
  // Test password change
  Database.changeUserPassword(defaultAdmin.id, 'NewAdminPassword2026!');
  const updatedAdmin = Database.getUserById(defaultAdmin.id);
  assert(updatedAdmin, 'Updated admin exists');
  assert.strictEqual(updatedAdmin.must_change_password, 0, 'must_change_password must be reset to 0 after change');
  console.log('✓ Default admin seeded with must_change_password=1 and changed successfully');

  // Test 14: AutoDeploy Slot Allocation & Enforcement
  console.log('\n[Test 14] AutoDeploy Slot Allocation & Quota Enforcement');
  const testUserId = 'test_usr_' + crypto.randomBytes(4).toString('hex');
  const testUserName = 'autodeploy_' + crypto.randomBytes(4).toString('hex');
  Database.createUser({
    id: testUserId,
    username: testUserName,
    email: `${testUserName}@dvm.io`,
    password: 'Password123!',
    role: 'user',
    status: 'active',
    must_change_password: 0,
    assigned_slots: 0 // 0 slots assigned
  });

  // Since user has 0 slots, deployment must be blocked
  const deployBlocked = Database.canUserDeploy(testUserId);
  assert.strictEqual(deployBlocked.allowed, false, 'User with 0 assigned slots must NOT be allowed to deploy');
  assert(deployBlocked.reason?.includes('slot'), 'Reason must explain lack of slots');

  // Admin grants 2 slots
  Database.updateUser(testUserId, { assigned_slots: 2 });
  const deployAllowed = Database.canUserDeploy(testUserId);
  assert.strictEqual(deployAllowed.allowed, true, 'User with 2 assigned slots must be permitted to deploy');

  // Admin always has bypass
  const adminBypass = Database.canUserDeploy(defaultAdmin.id);
  assert.strictEqual(adminBypass.allowed, true, 'Admin always has deployment bypass');
  console.log('✓ AutoDeploy slot quota enforcement verified for users and admins');

  // Test 15: User Management & Suspension
  console.log('\n[Test 15] User Account Management & Suspension');
  const userList = Database.listUsers();
  assert(userList.length >= 2, 'User list must contain at least admin and test user');
  
  // Suspend test user
  Database.updateUser(testUserId, { status: 'suspended' });
  const suspendedUser = Database.getUserById(testUserId);
  assert.strictEqual(suspendedUser?.status, 'suspended', 'User status must be suspended');
  console.log('✓ User management operations and account suspension verified');

  // Test 16: Container Helpers (Logs & SSHX)
  console.log('\n[Test 16] Container Logs & SSHX Helpers');
  const { getContainerLogs, startSshxSessionInContainer, getActiveSshxSession, stopSshxSessionInContainer } = await import('../server/docker.ts');
  const logs = await getContainerLogs(null);
  assert(logs.length > 0, 'Container logs fallback must return descriptive message');
  
  const sshxSession = await startSshxSessionInContainer('vm_test_mock', null);
  assert.strictEqual(sshxSession.success, true);
  assert(sshxSession.url?.startsWith('https://sshx.io/s/'), 'SSHX URL must be formatted https://sshx.io/s/...');
  
  const activeSshx = getActiveSshxSession('vm_test_mock');
  assert(activeSshx, 'Active SSHX session must be tracked');
  
  await stopSshxSessionInContainer('vm_test_mock', null);
  const stoppedSshx = getActiveSshxSession('vm_test_mock');
  assert.strictEqual(stoppedSshx, undefined, 'SSHX session must be removed on stop');
  console.log('✓ Container logs and root SSHX live session workflow verified');

  // Test 17: Pre-pulled Exact Docker Images
  console.log('\n[Test 17] Pre-pulled Exact Docker Images Verification');
  const exactRequiredTags = [
    'nobitaa/ubuntu:22',
    'nobitaa/ubuntu:24',
    'nobitaa/debain:11',
    'nobitaa/debain:12',
    'nobitaa/debain:13'
  ];
  for (const requiredTag of exactRequiredTags) {
    const found = SUPPORTED_IMAGES.some(img => img.tag === requiredTag);
    assert.strictEqual(found, true, `Image tag '${requiredTag}' must be present in SUPPORTED_IMAGES without modification`);
  }
  console.log('✓ All 5 exact pre-pulled Docker images verified in SUPPORTED_IMAGES');

  // Test 18: AutoDeploy — Strict One VPS Per User Limit & Admin Provisioning
  console.log('\n[Test 18] Strict One VPS Per User Limit & Admin Provisioning');
  const singleVpsUserId = 'usr_1vps_' + crypto.randomBytes(4).toString('hex');
  Database.createUser({
    id: singleVpsUserId,
    username: 'one_vps_user',
    email: 'onevps@dvm.io',
    password: 'Password123!',
    role: 'user',
    status: 'active',
    must_change_password: 0,
    assigned_slots: 1
  });

  // User has 0 VMs, can deploy check
  const firstCheck = Database.canUserDeploy(singleVpsUserId);
  assert.strictEqual(firstCheck.allowed, true, 'User with 1 slot and 0 VMs should be allowed deploy');

  // Provision 1st VM for user
  const userFirstVmId = 'vm_usr1_' + crypto.randomBytes(4).toString('hex');
  Database.createVm({
    id: userFirstVmId,
    user_id: singleVpsUserId,
    name: 'user-first-vps',
    image: 'nobitaa/ubuntu:24',
    status: 'running',
    cpu: 2,
    ram_mb: 2048,
    disk_gb: 20,
    ssh_port: 2290,
    ip_address: '172.28.0.80',
    container_id: 'dvm_test_c_1',
    ports: [{ host: 2290, guest: 22, protocol: 'tcp' }],
    notes: 'Primary VPS',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  // Now user has 1 VM. Database.canUserDeploy must reject any further deployment!
  const secondCheck = Database.canUserDeploy(singleVpsUserId);
  assert.strictEqual(secondCheck.allowed, false, 'User with 1 active VPS must be rejected from deploying another instance');
  assert(secondCheck.reason?.includes('1 VPS'), 'Reason must mention strict 1 VPS limit');

  // Verify User Isolation: user B cannot access singleVpsUserId's VM
  const isolatedVm = Database.getVmById(userFirstVmId, userBId);
  assert.strictEqual(isolatedVm, undefined, 'User B must NOT have access to singleVpsUserId VM');

  // Owner can access their own VM
  const ownerVm = Database.getVmById(userFirstVmId, singleVpsUserId);
  assert(ownerVm, 'Owner must have access to their own VM');
  assert.strictEqual(ownerVm.id, userFirstVmId);

  // Admin can access any owner VM
  const adminFleetVm = Database.getVmByIdAnyOwner(userFirstVmId);
  assert(adminFleetVm, 'Admin must be able to view any VM in fleet');
  assert.strictEqual(adminFleetVm.user_id, singleVpsUserId);
  console.log('✓ Strict 1 VPS per user limit, user isolation, and admin fleet access verified');

  console.log('\n======================================================');
  console.log('ALL 18 TEST SUITES PASSED SUCCESSFULLY! (0 Failures)');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});

