/*
  Warnings:

  - You are about to drop the column `url` on the `PropertyImage` table. All the data in the column will be lost.
  - Added the required column `storageKey` to the `PropertyImage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "KycVerification" ADD COLUMN     "documentBackKey" TEXT,
ADD COLUMN     "documentFrontKey" TEXT,
ADD COLUMN     "selfieKey" TEXT;

-- AlterTable
ALTER TABLE "PropertyImage" DROP COLUMN "url",
ADD COLUMN     "altText" TEXT,
ADD COLUMN     "storageKey" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "profilePhotoKey" TEXT;
