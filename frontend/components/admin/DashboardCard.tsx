interface DashboardCardProps {
  title: string;
  value: string;
  growth?: string;
}

export function DashboardCard({ title, value, growth = '+20.1% from last month' }: DashboardCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-xs font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-xl font-bold text-gray-900">{value}</p>
      {growth && <p className="mt-1 text-xs text-green-600">{growth}</p>}
    </div>
  );
}
