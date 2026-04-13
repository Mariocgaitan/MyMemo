param(
    [string]$UserName = "mymemo-dashboard-user",
    [string]$PolicyName = "MyMemoDashboardPolicy",
    [string]$PolicyDocumentPath = "./deployment/aws-dashboard-policy.json"
)

$ErrorActionPreference = "Stop"

Write-Host "Creating/Updating IAM policy and user for MyMemo dashboard..."

$accountId = aws sts get-caller-identity --query Account --output text
if (-not $accountId) {
    throw "Could not resolve AWS account ID. Verify AWS CLI credentials/profile."
}

$policyArn = "arn:aws:iam::${accountId}:policy/${PolicyName}"

# 1) Create policy if it does not exist
$existingPolicyArn = aws iam list-policies --scope Local --query "Policies[?PolicyName=='$PolicyName'].Arn | [0]" --output text
if ($existingPolicyArn -eq "None" -or -not $existingPolicyArn) {
    Write-Host "Creating IAM policy: $PolicyName"
    aws iam create-policy --policy-name $PolicyName --policy-document "file://$PolicyDocumentPath" | Out-Null
} else {
    Write-Host "Policy already exists: $existingPolicyArn"
    $policyArn = $existingPolicyArn
}

# 2) Create IAM user if it does not exist
$userExists = $false
try {
    aws iam get-user --user-name $UserName | Out-Null
    $userExists = $true
} catch {
    $userExists = $false
}

if (-not $userExists) {
    Write-Host "Creating IAM user: $UserName"
    aws iam create-user --user-name $UserName | Out-Null
} else {
    Write-Host "User already exists: $UserName"
}

# 3) Attach policy to user
Write-Host "Attaching policy to user..."
aws iam attach-user-policy --user-name $UserName --policy-arn $policyArn | Out-Null

# 4) Create access key (shows once)
Write-Host "Creating access key (store securely)..."
$keyJson = aws iam create-access-key --user-name $UserName --output json
$key = $keyJson | ConvertFrom-Json

Write-Host "Done."
Write-Host "AWS_ACCESS_KEY_ID=$($key.AccessKey.AccessKeyId)"
Write-Host "AWS_SECRET_ACCESS_KEY=$($key.AccessKey.SecretAccessKey)"
Write-Host "AWS_REGION=us-east-1"
Write-Host ""
Write-Host "Next: place these values in backend/.env and restart backend."
