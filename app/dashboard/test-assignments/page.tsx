import { getTeamMembers, getMyTasks } from '@/actions/assignments';

export default async function TestPage() {
  const members = await getTeamMembers();
  const myTasks = await getMyTasks();
  return (
    <div dir="rtl" style={{ padding: 32 }}>
      <h1>أعضاء الفريق</h1>
      <pre>{JSON.stringify(members, null, 2)}</pre>
      <h1>مهامي</h1>
      <pre>{JSON.stringify(myTasks, null, 2)}</pre>
    </div>
  );
}
