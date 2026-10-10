import type { POSProduct, ProductCategory, StockItem } from "@/lib/store"

/** Scope of the active application. Archived records remain stored for compatibility. */
export function pousadaProducts<T extends Pick<POSProduct, "categoryId">>(products: T[], categories: Pick<ProductCategory, "id" | "isRestaurant">[]): T[] {
  const archived = new Set(categories.filter(category => category.isRestaurant).map(category => category.id))
  return products.filter(product => !archived.has(product.categoryId))
}

export function pousadaStock<T extends Pick<StockItem, "productId">>(items: T[], products: Pick<POSProduct, "id" | "categoryId">[], categories: Pick<ProductCategory, "id" | "isRestaurant">[]): T[] {
  const archived = new Set(categories.filter(category => category.isRestaurant).map(category => category.id))
  const archivedProducts = new Set(products.filter(product => archived.has(product.categoryId)).map(product => product.id))
  return items.filter(item => !archivedProducts.has(item.productId))
}

const archivedPermissionPrefixes = ["restaurant.", "restaurantTables.", "restaurantOrders.", "recipes.", "productions.", "production.", "employees.", "employeeConsumptions.", "employee."]
export function isPousadaPermission(permission: string): boolean {
  return !archivedPermissionPrefixes.some(prefix => permission.startsWith(prefix))
}

export function isPousadaNotification(type: string): boolean {
  return type !== "restaurant" && type !== "production"
}
