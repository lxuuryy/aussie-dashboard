import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader>
          <CardTitle>Total Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">$1,250.00</p>
          <p className="text-sm text-muted-foreground">+12.5% this month</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>New Customers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">1,234</p>
          <p className="text-sm text-muted-foreground">-20% this period</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Active Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">45,678</p>
          <p className="text-sm text-muted-foreground">+12.5% retention</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Growth Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">4.5%</p>
          <p className="text-sm text-muted-foreground">+4.5% steady increase</p>
        </CardContent>
      </Card>
    </div>
  );
}