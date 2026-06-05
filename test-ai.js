const http = require("http");

const body = JSON.stringify({
  title: "The Day I Lost Everything and Found Myself",
  description:
    "I lost my job, my savings, and almost my will to live. But through that darkness, I discovered my real purpose. Sometimes losing everything is the first step to building something meaningful.",
  category: "Resilience",
  emotionalTone: "Hopeful",
  comments: [
    { comment: "This really moved me. Thank you for sharing." },
    { comment: "I went through the same thing. You're not alone." },
  ],
});

const options = {
  hostname: "localhost",
  port: 3000,
  path: "/ai-summary",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  },
};

console.log("🤖 Testing AI Summary API...\n");

const req = http.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.success) {
        console.log("✅ SUCCESS!\n");
        console.log("💬 Power Quote:", parsed.summary.powerQuote);
        console.log("\n🎯 Key Takeaways:");
        parsed.summary.keyTakeaways.forEach((t, i) =>
          console.log(`  ${i + 1}. ${t}`)
        );
        console.log("\n💜 Emotional Insight:", parsed.summary.emotionalInsight);
        console.log("\n⚡ Suggested Action:", parsed.summary.suggestedAction);
        console.log("\n🌐 Community Mood:", parsed.summary.communityMood);
      } else {
        console.log("❌ ERROR:", data);
      }
    } catch (e) {
      console.log("❌ Parse error:", data);
    }
  });
});

req.on("error", (e) => console.error("Request failed:", e.message));
req.write(body);
req.end();
