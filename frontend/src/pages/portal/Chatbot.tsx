import { DashboardShell } from '../../components/DashboardShell';
import { ChatbotPanel } from '../../components/ChatbotPanel';

export default function PortalChatbot() {
  return (
    <DashboardShell title="LoanBot" subtitle="Ask questions about your credit report and loan eligibility">
      <div className="card" style={{ height: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column' }}>
        <ChatbotPanel
          mode="self"
          placeholder="e.g. Why was my home loan rejected? What can I do to improve my score?"
        />
      </div>
    </DashboardShell>
  );
}
