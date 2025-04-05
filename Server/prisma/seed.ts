import { PrismaClient, UserRole, OrderStatus, NotificationType, TransactionType } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

const BCRYPT_SALT_ROUNDS = process.env.BCRYPT_SALT_ROUNDS ? parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) : 10;

async function main() {
    console.log("🌱 Starting database seeding...");

    // --- Clear Existing Data (Optional - USE WITH CAUTION in non-dev environments) ---
    // It's often better to use upsert, but for a clean seed, deletion can be useful.
    // Order matters due to foreign key constraints! Delete dependent records first.
    console.log("   - Clearing existing data (order matters!)...");
    // Delete records that depend on others first
    await prisma.passwordResetToken.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.salesOrderItem.deleteMany();
    await prisma.purchaseOrderItem.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.stockLevel.deleteMany();
    await prisma.salesOrder.deleteMany();
    await prisma.purchaseOrder.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.supplier.deleteMany();
    await prisma.location.deleteMany();
    await prisma.user.deleteMany(); // Users last (or first if cascade deletes are setup differently)
    console.log("   - Existing data cleared.");

    // --- 1. Create Users ---
    console.log("   - Seeding Users...");
    const hashedPasswordAdmin = await bcrypt.hash("Password@123", BCRYPT_SALT_ROUNDS);
    const adminUser = await prisma.user.upsert({
        where: { email: "admin@inventory.ug" },
        update: {},
        create: {
            email: "admin@inventory.ug",
            passwordHash: hashedPasswordAdmin,
            firstName: "Admin",
            lastName: "User",
            role: UserRole.ADMIN,
            isActive: true,
        },
    });

    const hashedPasswordManager = await bcrypt.hash("Password@123", BCRYPT_SALT_ROUNDS);
    const managerUser = await prisma.user.upsert({
        where: { email: "manager.kampala@inventory.ug" },
        update: {},
        create: {
            email: "manager.kampala@inventory.ug",
            passwordHash: hashedPasswordManager,
            firstName: "Sarah",
            lastName: "Mukasa",
            role: UserRole.MANAGER,
            isActive: true,
        },
    });

    const hashedPasswordStaff = await bcrypt.hash("Password@123", BCRYPT_SALT_ROUNDS);
    const staffUser = await prisma.user.upsert({
        where: { email: "staff.warehouse@inventory.ug" },
        update: {},
        create: {
            email: "staff.warehouse@inventory.ug",
            passwordHash: hashedPasswordStaff,
            firstName: "David",
            lastName: "Okello",
            role: UserRole.STAFF,
            isActive: true,
        },
    });

    const hashedPasswordInactive = await bcrypt.hash("Password@123", BCRYPT_SALT_ROUNDS);
    const inactiveStaffUser = await prisma.user.upsert({
        where: { email: "grace.inactive@inventory.ug" },
        update: { isActive: false },
        create: {
            email: "grace.inactive@inventory.ug",
            passwordHash: hashedPasswordInactive,
            firstName: "Grace",
            lastName: "Nansubuga",
            role: UserRole.STAFF,
            isActive: false, // Explicitly inactive
        },
    });
    console.log(`     - Created/Updated Users: ${adminUser.email}, ${managerUser.email}, ${staffUser.email}, ${inactiveStaffUser.email}`);

    // --- 2. Create Categories ---
    console.log("   - Seeding Categories...");
    const electronicsCat = await prisma.category.upsert({
        where: { name: "Electronics" },
        update: {},
        create: { name: "Electronics", description: "Consumer and business electronic devices." },
    });
    const beveragesCat = await prisma.category.upsert({
        where: { name: "Beverages" },
        update: {},
        create: { name: "Beverages", description: "Soft drinks, juices, water, etc." },
    });
    const foodstuffsCat = await prisma.category.upsert({
        where: { name: "Foodstuffs" },
        update: {},
        create: { name: "Foodstuffs", description: "Dry goods like sugar, flour, rice." },
    });
    const buildingCat = await prisma.category.upsert({
        where: { name: "Building Materials" },
        update: {},
        create: { name: "Building Materials", description: "Cement, paint, roofing materials." },
    });
    const householdCat = await prisma.category.upsert({
        where: { name: "Household Goods" },
        update: {},
        create: { name: "Household Goods", description: "Soaps, cooking oil, cleaning supplies." },
    });
    console.log(
        `     - Created/Updated Categories: ${electronicsCat.name}, ${beveragesCat.name}, ${foodstuffsCat.name}, ${buildingCat.name}, ${householdCat.name}`,
    );

    // --- 3. Create Locations ---
    console.log("   - Seeding Locations...");
    const kampalaWarehouse = await prisma.location.upsert({
        where: { name: "Kampala Central Warehouse" },
        update: {},
        create: { name: "Kampala Central Warehouse", address: "Plot 1-5 Industrial Area, Kampala" },
    });
    const nakaseroShop = await prisma.location.upsert({
        where: { name: "Nakasero Shop Front" },
        update: {},
        create: { name: "Nakasero Shop Front", address: "10 Market Street, Nakasero, Kampala" },
    });
    const ntindaStorage = await prisma.location.upsert({
        where: { name: "Ntinda Storage Unit" },
        update: {},
        create: { name: "Ntinda Storage Unit", address: "Unit 7, Ntinda Industrial Park, Kampala" },
    });
    console.log(`     - Created/Updated Locations: ${kampalaWarehouse.name}, ${nakaseroShop.name}, ${ntindaStorage.name}`);

    // --- 4. Create Suppliers ---
    console.log("   - Seeding Suppliers...");
    const mukwano = await prisma.supplier.upsert({
        where: { name: "Mukwano Industries Ltd" },
        update: {},
        create: {
            name: "Mukwano Industries Ltd",
            contactPerson: "Sales Department",
            email: "sales@mukwano.com",
            phone: "+256-XXX-XXXXXX",
            address: "Industrial Area, Kampala",
        },
    });
    const cocaCola = await prisma.supplier.upsert({
        where: { name: "Century Bottling Company" },
        update: {},
        create: { name: "Century Bottling Company", email: "orders@cocacola.co.ug", phone: "+256-YYY-YYYYYY", address: "Namanve Industrial Park" },
    });
    const ugElectronics = await prisma.supplier.upsert({
        where: { name: "Kampala Electronics Hub" },
        update: {},
        create: { name: "Kampala Electronics Hub", contactPerson: "Mr. Patel", phone: "+256-ZZZ-ZZZZZZ", address: "Nasser Road, Kampala" },
    });
    const buildMart = await prisma.supplier.upsert({
        where: { name: "BuildMart Uganda" },
        update: {},
        create: { name: "BuildMart Uganda", email: "info@buildmart.ug", phone: "+256-AAA-AAAAAA", address: "Lugogo Bypass, Kampala" },
    });
    console.log(`     - Created/Updated Suppliers: ${mukwano.name}, ${cocaCola.name}, ${ugElectronics.name}, ${buildMart.name}`);

    // --- 5. Create Products ---
    console.log("   - Seeding Products...");
    const tecnoPhone = await prisma.product.upsert({
        where: { sku: "TEC-SPK20" },
        update: {},
        create: {
            sku: "TEC-SPK20",
            name: "Tecno Spark 20",
            description: "Smartphone, 8GB RAM, 128GB Storage",
            categoryId: electronicsCat.id,
            unit: "pcs",
            reorderLevel: 5,
            costPrice: 400000,
            sellingPrice: 480000,
            imageUrl: "https://via.placeholder.com/150/electronics",
        },
    });
    const cokeCrate = await prisma.product.upsert({
        where: { sku: "CC-PET500-CR24" },
        update: {},
        create: {
            sku: "CC-PET500-CR24",
            name: "Coca-Cola 500ml Crate (24pcs)",
            categoryId: beveragesCat.id,
            unit: "crate",
            reorderLevel: 10,
            costPrice: 25000,
            sellingPrice: 30000,
            imageUrl: "https://via.placeholder.com/150/beverages",
        },
    });
    const omoSoap = await prisma.product.upsert({
        where: { sku: "MUK-OMO-1KG" },
        update: {},
        create: {
            sku: "MUK-OMO-1KG",
            name: "Omo Washing Powder 1kg",
            categoryId: householdCat.id,
            unit: "kg",
            reorderLevel: 50,
            costPrice: 8000,
            sellingPrice: 9500,
            imageUrl: "https://via.placeholder.com/150/household",
        },
    });
    const cementBag = await prisma.product.upsert({
        where: { sku: "HIMA-CEM-50KG" },
        update: {},
        create: {
            sku: "HIMA-CEM-50KG",
            name: "Hima Cement 50kg Bag",
            categoryId: buildingCat.id,
            unit: "bag",
            reorderLevel: 20,
            costPrice: 33000,
            sellingPrice: 35000,
            imageUrl: "https://via.placeholder.com/150/building",
        },
    });
    const sugarKg = await prisma.product.upsert({
        where: { sku: "KAK-SUG-1KG" },
        update: {},
        create: {
            sku: "KAK-SUG-1KG",
            name: "Kinyara Sugar 1kg",
            categoryId: foodstuffsCat.id,
            unit: "kg",
            reorderLevel: 100,
            costPrice: 4800,
            sellingPrice: 5500,
        },
    });
    console.log(`     - Created/Updated Products: ${tecnoPhone.name}, ${cokeCrate.name}, ${omoSoap.name}, ${cementBag.name}, ${sugarKg.name}`);

    // --- 6. Create Initial Stock Levels ---
    // Use Transactions API later for real data, but seed some for testing UI
    console.log("   - Seeding Initial Stock Levels...");
    const stockPhoneNakasero = await prisma.stockLevel.upsert({
        where: { productId_locationId: { productId: tecnoPhone.id, locationId: nakaseroShop.id } },
        update: {},
        create: { productId: tecnoPhone.id, locationId: nakaseroShop.id, quantity: 8 },
    });
    const stockPhoneWarehouse = await prisma.stockLevel.upsert({
        where: { productId_locationId: { productId: tecnoPhone.id, locationId: kampalaWarehouse.id } },
        update: {},
        create: { productId: tecnoPhone.id, locationId: kampalaWarehouse.id, quantity: 25 },
    });
    const stockCokeWarehouse = await prisma.stockLevel.upsert({
        where: { productId_locationId: { productId: cokeCrate.id, locationId: kampalaWarehouse.id } },
        update: {},
        create: { productId: cokeCrate.id, locationId: kampalaWarehouse.id, quantity: 50 },
    });
    const stockOmoWarehouse = await prisma.stockLevel.upsert({
        where: { productId_locationId: { productId: omoSoap.id, locationId: kampalaWarehouse.id } },
        update: {},
        create: { productId: omoSoap.id, locationId: kampalaWarehouse.id, quantity: 150 },
    });
    const stockCementWarehouse = await prisma.stockLevel.upsert({
        where: { productId_locationId: { productId: cementBag.id, locationId: ntindaStorage.id } },
        update: {},
        create: { productId: cementBag.id, locationId: ntindaStorage.id, quantity: 80 },
    });
    console.log(`     - Created/Updated initial stock levels.`);

    // --- 7. Create Sample Purchase Order ---
    console.log("   - Seeding Sample Purchase Order...");
    const po1 = await prisma.purchaseOrder.create({
        data: {
            orderNumber: "PO-2024-0001",
            supplierId: ugElectronics.id,
            userId: managerUser.id,
            status: OrderStatus.PENDING,
            orderDate: new Date(),
            items: {
                create: [{ productId: tecnoPhone.id, quantityOrdered: 15, unitCost: 395000 }],
            },
            notes: "Urgent restock for Nakasero shop.",
        },
    });
    console.log(`     - Created Sample PO: ${po1.orderNumber}`);

    // --- 8. Create Sample Sales Order ---
    console.log("   - Seeding Sample Sales Order...");
    const so1 = await prisma.salesOrder.create({
        data: {
            orderNumber: "SO-2024-0001",
            customerRef: "Walk-in Customer Nakasero",
            userId: staffUser.id, // Staff created the SO
            status: OrderStatus.PENDING,
            orderDate: new Date(),
            items: {
                create: [
                    { productId: tecnoPhone.id, quantityOrdered: 1, unitPrice: 485000 },
                    { productId: sugarKg.id, quantityOrdered: 5, unitPrice: 5500 }, // Let's assume shop sells sugar too
                ],
            },
            notes: "Customer waiting at Nakasero shop.",
        },
    });
    console.log(`     - Created Sample SO: ${so1.orderNumber}`);

    // --- 9. Seed Sample Transaction (Manual Adjustment Example) ---
    console.log("   - Seeding Sample Adjustment Transaction...");
    // Need transaction service logic for this usually, but direct seeding for example:
    // Use $transaction for atomicity if updating stock level directly here.
    const adjustmentTx = await prisma.transaction.create({
        data: {
            type: TransactionType.ADJUSTMENT_IN, // e.g., found stock during count
            productId: sugarKg.id,
            quantityChange: 10, // Found 10 extra kg
            userId: managerUser.id,
            destinationLocationId: kampalaWarehouse.id, // Adjusted at warehouse
            notes: "Stock count reconciliation finding",
            timestamp: new Date(),
        },
    });
    // IMPORTANT: Need to manually update StockLevel if seeding transaction directly like this!
    await prisma.stockLevel.upsert({
        where: { productId_locationId: { productId: sugarKg.id, locationId: kampalaWarehouse.id } },
        update: { quantity: { increment: 10 } },
        create: { productId: sugarKg.id, locationId: kampalaWarehouse.id, quantity: 10 },
    });
    console.log(`     - Created Sample Transaction: Adjustment ID ${adjustmentTx.id}`);

    // --- 10. Seed Sample Notification (Example) ---
    console.log("   - Seeding Sample Notification...");
    await prisma.notification.create({
        data: {
            userId: adminUser.id,
            message: `System seeding completed successfully at ${new Date().toLocaleString()}`,
            type: NotificationType.SYSTEM_ALERT,
            isRead: false,
        },
    });
    await prisma.notification.create({
        data: {
            userId: managerUser.id,
            message: `Reminder: Review pending PO ${po1.orderNumber}`,
            type: NotificationType.ORDER_STATUS_UPDATE, // Or a custom reminder type
            relatedEntityId: po1.id,
            relatedEntityType: "PurchaseOrder",
            isRead: false,
        },
    });
    console.log(`     - Created sample notifications.`);

    // --- 11. Seed Sample Audit Log (Example) ---
    console.log("   - Seeding Sample Audit Log...");
    await prisma.auditLog.create({
        data: {
            userId: adminUser.id,
            action: "SEED_DATABASE",
            entity: "System",
            details: { status: "Completed", seededAt: new Date() },
        },
    });
    console.log(`     - Created sample audit log.`);

    console.log("✅ Seeding finished successfully!");
}

main()
    .catch((e) => {
        console.error("❌ Seeding failed:");
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        console.log("🔌 Prisma Client disconnected.");
    });
