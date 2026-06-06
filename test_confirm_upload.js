import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config({ path: "src/.env" });

async function main() {
  const jwtSecret = process.env.JWT_SECRET || "KhaembaNoah.2546";
  const token = jwt.sign(
    { id: "6a158ea9dd11827240bf7af9", role: "buyer" },
    jwtSecret,
    { expiresIn: "1h" }
  );

  const url = "http://127.0.0.1:5000/api/v1/datasets/confirmUpload";
  const payload = {
    r2Key: "datasets/6a158ea9dd11827240bf7af9/f9ef7583-44cd-4a2c-82d4-331e1906b560",
    datasetId: "6a204f1fdcb61a74d4e65219",
    dataType: "audio"
  };

  const startTime = Date.now();
  console.log("Triggering confirmUpload...");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `accessToken=${token}`
      },
      body: JSON.stringify(payload)
    });

    const duration = Date.now() - startTime;
    console.log(`Response Status: ${res.status} ${res.statusText} in ${duration}ms`);
    const data = await res.json();
    console.log("Response Body:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Failed to request:", error);
  }
}

main().catch(console.error);
