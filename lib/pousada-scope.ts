import type { POSProduct, ProductCategory, StockItem } from "@/lib/store"

/** Active categories belong to the beverage catalogue; restaurant categories are archived. */
export function pousadaProducts<T extends Pick<POSProduct, "categoryId">>(products: T[], categories: Pick<ProductCategory, "id" | "isRestaurant">[]): T[] {
  const active = new Set(categories.filter(category => !category.isRestaurant).map(category => category.id))
  return products.filter(product => active.has(product.categoryId))
}

export function pousadaStock<T extends Pick<StockItem, "productId">>(items: T[], products: Pick<POSProduct, "id" | "categoryId">[], categories: Pick<ProductCategory, "id" | "isRestaurant">[]): T[] {
  const active = new Set(pousadaProducts(products, categories).map(product => product.id))
  return items.filter(item => active.has(item.productId))
}

const archivedPermissionPrefixes = ["restaurant.", "restaurantTables.", "restaurantOrders.", "recipes.", "productions.", "production.", "employees.", "employeeConsumptions.", "employee."]
export function isPousadaPermission(permission: string): boolean {
  return !archivedPermissionPrefixes.some(prefix => permission.startsWith(prefix))
}

export function isPousadaNotification(type: string): boolean {
  return type !== "restaurant" && type !== "production"
}
