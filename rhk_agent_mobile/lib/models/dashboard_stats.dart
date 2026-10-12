class DashboardStats {
  final int total;
  final int month;
  final Map<String, int> rhkCountsMonth;

  const DashboardStats({
    this.total = 0,
    this.month = 0,
    this.rhkCountsMonth = const {},
  });
}
