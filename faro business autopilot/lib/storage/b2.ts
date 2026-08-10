import "server-only";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "node:crypto";

const client = new S3Client({
  region: process.env.B2_REGION!,
  endpoint: `https://${process.env.B2_ENDPOINT}`,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APPLICATION_KEY!,
  },
});

export async function uploadObject(input: {
  objectKey: string;
  body: Buffer;
  contentType: string;
}): Promise<{ checksumSha256: string; sizeBytes: number }> {
  const checksumSha256 = createHash("sha256").update(input.body).digest("hex");

  await client.send(
    new PutObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME!,
      Key: input.objectKey,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );

  return { checksumSha256, sizeBytes: input.body.length };
}

export async function getSignedDownloadUrl(objectKey: string, expiresInSeconds = 300): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME!,
    Key: objectKey,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}
