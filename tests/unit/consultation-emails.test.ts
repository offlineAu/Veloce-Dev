import { describe, expect, it } from "vitest";
import { leadAckEmail, leadTeamEmail } from "@/server/notifications/templates";

describe("consultation emails", () => {
  it("explains the consultation follow-up in both email formats", () => {
    const message = leadAckEmail({ company: "Test Co", name: "Ana Cruz", intent: "CONSULTATION" });
    expect(message.subject).toBe("We received your consultation request");
    for (const body of [message.text, message.html]) {
      expect(body).toContain("consultation request");
      expect(body).toContain("We confirm the scope and any cost before you commit.");
      expect(body).not.toContain("arrange a first conversation");
    }
  });

  it("keeps the project acknowledgment for conversation inquiries", () => {
    const message = leadAckEmail({ company: "Test Co", name: "Ana Cruz", intent: "CONVERSATION" });
    expect(message.subject).toBe("We received your inquiry");
    expect(message.text).toContain("arrange a first conversation");
  });

  it("identifies the advice topic and question in the team notification", () => {
    const message = leadTeamEmail({
      company: "Test Co", name: "Ana Cruz", email: "ana@example.com",
      projectType: "Improving a business workflow", goals: "Should we connect our booking tool?",
      intent: "CONSULTATION", source: "Direct",
    });
    expect(message.subject).toBe("Consultation request from Ana Cruz");
    for (const body of [message.text, message.html]) {
      expect(body).toContain("Advice topic");
      expect(body).toContain("Question or decision");
      expect(body).toContain("Improving a business workflow");
      expect(body).toContain("Should we connect our booking tool?");
    }
  });
});
