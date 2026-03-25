"use server";

import { sql, getSqlClient } from "@/lib/db";
import { cache } from "react";
import {
  syncPatientToZains,
  syncTransactionsToZainsByTransactionIdSequential,
} from "@/lib/services/zains-sync";

// Legacy implementation (masih disimpan jika suatu saat perlu dirujuk kembali)
// Jangan digunakan langsung di code baru.
export const getTransactionsLegacy = cache(
  async (
    search?: string,
    clinicId?: number,
    dateFrom?: string,
    dateTo?: string,
    page: number = 1,
    limit: number = 10,
    polyId?: number,
    insuranceTypeId?: number,
  ) => {
    try {
      const offset = (page - 1) * limit;

      // Build date filter - handle multiple conditions
      // Normalize dates - hanya gunakan jika bukan empty string
      const validDateFrom =
        dateFrom && dateFrom.trim() !== "" ? dateFrom : undefined;
      const validDateTo = dateTo && dateTo.trim() !== "" ? dateTo : undefined;

      // Store date values for direct use in queries (avoid sql`` empty template)
      let dateFromValue: string | undefined = undefined;
      let dateToValue: string | undefined = undefined;
      let hasDateFilter = false;

      if (validDateFrom && validDateTo) {
        dateFromValue = validDateFrom;
        dateToValue = validDateTo;
        hasDateFilter = true;
      } else if (validDateFrom) {
        dateFromValue = validDateFrom;
        hasDateFilter = true;
      } else if (validDateTo) {
        dateToValue = validDateTo;
        hasDateFilter = true;
      }

      // Build date condition SQL secara dinamis (fragment)
      // Hanya digunakan di dalam template sql utama
      let dateCondition: any = sql``;
      if (hasDateFilter) {
        if (dateFromValue && dateToValue) {
          dateCondition = sql`AND DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})`;
        } else if (dateFromValue) {
          dateCondition = sql`AND DATE(t.trx_date) >= DATE(${dateFromValue})`;
        } else if (dateToValue) {
          dateCondition = sql`AND DATE(t.trx_date) <= DATE(${dateToValue})`;
        }
      }

      // Build poly filter
      let polyFilter = sql``;
      let hasPolyFilter = false;
      if (polyId) {
        polyFilter = sql`AND t.poly_id = ${polyId}`;
        hasPolyFilter = true;
      }

      // Build insurance filter
      let insuranceFilter = sql``;
      let hasInsuranceFilter = false;
      if (insuranceTypeId) {
        insuranceFilter = sql`AND t.insurance_type_id = ${insuranceTypeId}`;
        hasInsuranceFilter = true;
      }

      // Build query dengan kondisi dinamis - menggunakan parallel fetching
      if (search && clinicId) {
        const searchPattern = `%${search}%`;
        // Build query berdasarkan kombinasi filter
        if (hasDateFilter && hasPolyFilter && hasInsuranceFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${
              hasDateFilter && dateFromValue && dateToValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : hasDateFilter && dateFromValue
                  ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue})`
                  : hasDateFilter && dateToValue
                    ? sql`AND DATE(t.trx_date) <= DATE(${dateToValue})`
                    : sql``
            }
            ${hasPolyFilter ? sql`AND t.poly_id = ${polyId}` : sql``}
            ${hasInsuranceFilter ? sql`AND t.insurance_type_id = ${insuranceTypeId}` : sql``}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${
              hasDateFilter && dateFromValue && dateToValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : hasDateFilter && dateFromValue
                  ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue})`
                  : hasDateFilter && dateToValue
                    ? sql`AND DATE(t.trx_date) <= DATE(${dateToValue})`
                    : sql``
            }
            ${hasPolyFilter ? sql`AND t.poly_id = ${polyId}` : sql``}
            ${hasInsuranceFilter ? sql`AND t.insurance_type_id = ${insuranceTypeId}` : sql``}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else if (hasDateFilter && hasPolyFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${
              hasDateFilter && dateFromValue && dateToValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : hasDateFilter && dateFromValue
                  ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue})`
                  : hasDateFilter && dateToValue
                    ? sql`AND DATE(t.trx_date) <= DATE(${dateToValue})`
                    : sql``
            }
            ${hasPolyFilter ? sql`AND t.poly_id = ${polyId}` : sql``}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${dateCondition}
            ${polyFilter}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else if (hasDateFilter && hasInsuranceFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${
              hasDateFilter && dateFromValue && dateToValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : hasDateFilter && dateFromValue
                  ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue})`
                  : hasDateFilter && dateToValue
                    ? sql`AND DATE(t.trx_date) <= DATE(${dateToValue})`
                    : sql``
            }
            ${hasInsuranceFilter ? sql`AND t.insurance_type_id = ${insuranceTypeId}` : sql``}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${dateCondition}
            ${insuranceFilter}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else if (hasPolyFilter && hasInsuranceFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${hasPolyFilter ? sql`AND t.poly_id = ${polyId}` : sql``}
            ${hasInsuranceFilter ? sql`AND t.insurance_type_id = ${insuranceTypeId}` : sql``}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${polyFilter}
            ${insuranceFilter}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else if (hasDateFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${
              hasDateFilter && dateFromValue && dateToValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : hasDateFilter && dateFromValue
                  ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue})`
                  : hasDateFilter && dateToValue
                    ? sql`AND DATE(t.trx_date) <= DATE(${dateToValue})`
                    : sql``
            }
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${dateCondition}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else if (hasPolyFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${polyFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${polyFilter}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else if (hasInsuranceFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${insuranceFilter}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else {
          // Hanya search dan clinicId, tanpa filter lain
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        }
        const countResult = Array.isArray(countResultRaw)
          ? countResultRaw[0]
          : countResultRaw;

        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        };
      } else if (search) {
        // Build WHERE clause dengan search, dateFilter, dan polyFilter
        // Gunakan pendekatan yang lebih aman dengan membangun query berdasarkan kondisi
        const searchPattern = `%${search}%`;

        // Build query berdasarkan kombinasi filter yang ada
        if (hasDateFilter && hasPolyFilter && hasInsuranceFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${
              hasDateFilter && dateFromValue && dateToValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : hasDateFilter && dateFromValue
                  ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue})`
                  : hasDateFilter && dateToValue
                    ? sql`AND DATE(t.trx_date) <= DATE(${dateToValue})`
                    : sql``
            }
            ${hasPolyFilter ? sql`AND t.poly_id = ${polyId}` : sql``}
            ${hasInsuranceFilter ? sql`AND t.insurance_type_id = ${insuranceTypeId}` : sql``}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${
              hasDateFilter && dateFromValue && dateToValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : hasDateFilter && dateFromValue
                  ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue})`
                  : hasDateFilter && dateToValue
                    ? sql`AND DATE(t.trx_date) <= DATE(${dateToValue})`
                    : sql``
            }
            ${hasPolyFilter ? sql`AND t.poly_id = ${polyId}` : sql``}
            ${hasInsuranceFilter ? sql`AND t.insurance_type_id = ${insuranceTypeId}` : sql``}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else if (hasDateFilter && hasPolyFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${
              hasDateFilter && dateFromValue && dateToValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : hasDateFilter && dateFromValue
                  ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue})`
                  : hasDateFilter && dateToValue
                    ? sql`AND DATE(t.trx_date) <= DATE(${dateToValue})`
                    : sql``
            }
            ${hasPolyFilter ? sql`AND t.poly_id = ${polyId}` : sql``}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${dateCondition}
            ${polyFilter}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else if (hasDateFilter && hasInsuranceFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${
              hasDateFilter && dateFromValue && dateToValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : hasDateFilter && dateFromValue
                  ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue})`
                  : hasDateFilter && dateToValue
                    ? sql`AND DATE(t.trx_date) <= DATE(${dateToValue})`
                    : sql``
            }
            ${hasInsuranceFilter ? sql`AND t.insurance_type_id = ${insuranceTypeId}` : sql``}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${dateCondition}
            ${insuranceFilter}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else if (hasPolyFilter && hasInsuranceFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${hasPolyFilter ? sql`AND t.poly_id = ${polyId}` : sql``}
            ${hasInsuranceFilter ? sql`AND t.insurance_type_id = ${insuranceTypeId}` : sql``}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${polyFilter}
            ${insuranceFilter}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else if (hasDateFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${
              hasDateFilter && dateFromValue && dateToValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : hasDateFilter && dateFromValue
                  ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue})`
                  : hasDateFilter && dateToValue
                    ? sql`AND DATE(t.trx_date) <= DATE(${dateToValue})`
                    : sql``
            }
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${dateCondition}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else if (hasPolyFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${polyFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${polyFilter}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else if (hasInsuranceFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${insuranceFilter}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else {
          // Hanya search, tanpa filter lain
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        }
      } else if (clinicId) {
        // Build query berdasarkan kombinasi filter yang ada
        if (hasDateFilter && hasPolyFilter && hasInsuranceFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE t.clinic_id = ${clinicId}
            ${dateCondition}
            ${polyFilter}
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE t.clinic_id = ${clinicId}
            ${dateCondition}
            ${polyFilter}
            ${insuranceFilter}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else if (hasDateFilter && hasPolyFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE t.clinic_id = ${clinicId}
            ${dateCondition}
            ${polyFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE t.clinic_id = ${clinicId}
            ${dateCondition}
            ${polyFilter}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else if (hasDateFilter && hasInsuranceFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE t.clinic_id = ${clinicId}
            ${dateCondition}
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE t.clinic_id = ${clinicId}
            ${dateCondition}
            ${insuranceFilter}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else if (hasPolyFilter && hasInsuranceFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE t.clinic_id = ${clinicId}
            ${polyFilter}
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE t.clinic_id = ${clinicId}
            ${polyFilter}
            ${insuranceFilter}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else if (hasDateFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE t.clinic_id = ${clinicId}
            ${dateCondition}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE t.clinic_id = ${clinicId}
            ${dateCondition}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else if (hasPolyFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE t.clinic_id = ${clinicId}
            ${polyFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE t.clinic_id = ${clinicId}
            ${polyFilter}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else if (hasInsuranceFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE t.clinic_id = ${clinicId}
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE t.clinic_id = ${clinicId}
            ${insuranceFilter}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else {
          // Hanya clinicId, tanpa filter lain
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE t.clinic_id = ${clinicId}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE t.clinic_id = ${clinicId}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        }
      } else {
        // Handle case with no search and no clinicId
        // Build query berdasarkan kombinasi filter yang ada
        if (hasDateFilter && hasPolyFilter && hasInsuranceFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE 1=1
            ${dateCondition}
            ${polyFilter}
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total FROM transactions t
            WHERE 1=1
            ${dateCondition}
            ${polyFilter}
            ${insuranceFilter}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else if (hasDateFilter && hasPolyFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE 1=1
            ${dateCondition}
            ${polyFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total FROM transactions t
            WHERE 1=1
            ${dateCondition}
            ${polyFilter}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else if (hasDateFilter && hasInsuranceFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE 1=1
            ${dateCondition}
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total FROM transactions t
            WHERE 1=1
            ${dateCondition}
            ${insuranceFilter}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else if (hasPolyFilter && hasInsuranceFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE 1=1
            ${polyFilter}
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total FROM transactions t
            WHERE 1=1
            ${polyFilter}
            ${insuranceFilter}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else if (hasDateFilter) {
          // Build date condition directly in query to avoid nested sql template issues
          if (dateFromValue && dateToValue) {
            const [transactions, countResultRaw] = await Promise.all([
              sql`
              SELECT 
                t.*,
                c.name as clinic_name,
                mp.name as master_poly_name,
                mit.name as master_insurance_name
              FROM transactions t
              JOIN clinics c ON c.id = t.clinic_id
              LEFT JOIN master_polies mp ON mp.id = t.poly_id
              LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
              WHERE DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})
              ORDER BY t.trx_date DESC, t.trx_time DESC
              LIMIT ${limit} OFFSET ${offset}
            `,
              sql`
              SELECT COUNT(*) as total FROM transactions t
              WHERE DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})
            `,
            ]);
            const countResult = Array.isArray(countResultRaw)
              ? countResultRaw[0]
              : countResultRaw;
            return {
              transactions: Array.isArray(transactions) ? transactions : [],
              total: Number((countResult as any)?.total || 0),
              page,
              limit,
            };
          } else if (dateFromValue) {
            const [transactions, countResultRaw] = await Promise.all([
              sql`
              SELECT 
                t.*,
                c.name as clinic_name,
                mp.name as master_poly_name,
                mit.name as master_insurance_name
              FROM transactions t
              JOIN clinics c ON c.id = t.clinic_id
              LEFT JOIN master_polies mp ON mp.id = t.poly_id
              LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
              WHERE DATE(t.trx_date) >= DATE(${dateFromValue})
              ORDER BY t.trx_date DESC, t.trx_time DESC
              LIMIT ${limit} OFFSET ${offset}
            `,
              sql`
              SELECT COUNT(*) as total FROM transactions t
              WHERE DATE(t.trx_date) >= DATE(${dateFromValue})
            `,
            ]);
            const countResult = Array.isArray(countResultRaw)
              ? countResultRaw[0]
              : countResultRaw;
            return {
              transactions: Array.isArray(transactions) ? transactions : [],
              total: Number((countResult as any)?.total || 0),
              page,
              limit,
            };
          } else if (dateToValue) {
            const [transactions, countResultRaw] = await Promise.all([
              sql`
              SELECT 
                t.*,
                c.name as clinic_name,
                mp.name as master_poly_name,
                mit.name as master_insurance_name
              FROM transactions t
              JOIN clinics c ON c.id = t.clinic_id
              LEFT JOIN master_polies mp ON mp.id = t.poly_id
              LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
              WHERE DATE(t.trx_date) <= DATE(${dateToValue})
              ORDER BY t.trx_date DESC, t.trx_time DESC
              LIMIT ${limit} OFFSET ${offset}
            `,
              sql`
              SELECT COUNT(*) as total FROM transactions t
              WHERE DATE(t.trx_date) <= DATE(${dateToValue})
            `,
            ]);
            const countResult = Array.isArray(countResultRaw)
              ? countResultRaw[0]
              : countResultRaw;
            return {
              transactions: Array.isArray(transactions) ? transactions : [],
              total: Number((countResult as any)?.total || 0),
              page,
              limit,
            };
          }
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else if (hasPolyFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE 1=1
            ${polyFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total FROM transactions t
            WHERE 1=1
            ${polyFilter}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else if (hasInsuranceFilter) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE 1=1
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total FROM transactions t
            WHERE 1=1
            ${insuranceFilter}
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        } else {
          // Tidak ada filter sama sekali
          const [transactions, countResultRaw] = await Promise.all([
            sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
            sql`
            SELECT COUNT(*) as total FROM transactions t
          `,
          ]);
          const countResult = Array.isArray(countResultRaw)
            ? countResultRaw[0]
            : countResultRaw;
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          };
        }
        const countResult = Array.isArray(countResultRaw)
          ? countResultRaw[0]
          : countResultRaw;

        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        };
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
      return {
        transactions: [],
        total: 0,
        page,
        limit,
      };
    }
  },
);

// Implementasi baru getTransactions dengan builder query yang jauh lebih sederhana
// Menggunakan getSqlClient() dan text query + parameter array agar tidak ada nested template sql
export const getTransactions = cache(
  async (
    search?: string,
    clinicId?: number,
    dateFrom?: string,
    dateTo?: string,
    page: number = 1,
    limit: number = 10,
    polyId?: number,
    insuranceTypeId?: number,
    zainsSynced?: "all" | "synced" | "pending",
    sort?: string
  ) => {
    try {
      const offset = (page - 1) * limit;
      const client = getSqlClient();

      // Normalisasi input
      const trimmedSearch =
        search && search.trim() !== "" ? search.trim() : undefined;
      const validDateFrom =
        dateFrom && dateFrom.trim() !== "" ? dateFrom : undefined;
      const validDateTo = dateTo && dateTo.trim() !== "" ? dateTo : undefined;

      const whereClauses: string[] = [];
      const params: any[] = [];
      let paramIndex = 0;

      // Filter klinik
      if (clinicId) {
        paramIndex++;
        params.push(clinicId);
        whereClauses.push(`t.clinic_id = $${paramIndex}`);
      }

      // Filter search (trx_no, patient_name, erm_no, nik, id_transaksi_zains, id_donatur_zains via transactions_to_zains)
      if (trimmedSearch) {
        paramIndex++;
        params.push(`%${trimmedSearch}%`);
        const idx = paramIndex;
        whereClauses.push(
          `(t.trx_no ILIKE $${idx} OR t.patient_name ILIKE $${idx} OR t.erm_no ILIKE $${idx} OR t.nik ILIKE $${idx} OR EXISTS (SELECT 1 FROM transactions_to_zains tz WHERE tz.transaction_id = t.id AND (tz.id_transaksi ILIKE $${idx} OR tz.id_donatur ILIKE $${idx})))`,
        );
      }

      // Filter tanggal (tanpa DATE(kolom) agar indeks pada trx_date bisa dipakai)
      if (validDateFrom && validDateTo) {
        paramIndex++;
        const fromIdx = paramIndex;
        params.push(validDateFrom);

        paramIndex++;
        const toIdx = paramIndex;
        params.push(validDateTo);

        whereClauses.push(
          `t.trx_date >= $${fromIdx}::date AND t.trx_date <= $${toIdx}::date`,
        );
      } else if (validDateFrom) {
        paramIndex++;
        params.push(validDateFrom);
        whereClauses.push(`t.trx_date >= $${paramIndex}::date`);
      } else if (validDateTo) {
        paramIndex++;
        params.push(validDateTo);
        whereClauses.push(`t.trx_date <= $${paramIndex}::date`);
      }

      // Filter poli
      if (polyId) {
        paramIndex++;
        params.push(polyId);
        whereClauses.push(`t.poly_id = $${paramIndex}`);
      }

      // Filter jenis asuransi
      if (insuranceTypeId) {
        paramIndex++;
        params.push(insuranceTypeId);
        whereClauses.push(`t.insurance_type_id = $${paramIndex}`);
      }

      // Filter sync Zains: synced = true, pending = false
      if (zainsSynced === "synced") {
        whereClauses.push("t.zains_synced = true");
      } else if (zainsSynced === "pending") {
        whereClauses.push("(t.zains_synced = false OR t.zains_synced IS NULL)");
      }

      const whereSql =
        whereClauses.length > 0 ? whereClauses.join(" AND ") : "TRUE";

      // Tambahkan parameter limit & offset
      paramIndex++;
      const limitIdx = paramIndex;
      params.push(limit);

      paramIndex++;
      const offsetIdx = paramIndex;
      params.push(offset);

      const baseFromForCount = `
      FROM transactions t
      JOIN clinics c ON c.id = t.clinic_id
      LEFT JOIN master_polies mp ON mp.id = t.poly_id
      LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
      WHERE ${whereSql}
    `;

      const baseFromWhere = `
      FROM transactions t
      JOIN clinics c ON c.id = t.clinic_id
      LEFT JOIN master_polies mp ON mp.id = t.poly_id
      LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
      LEFT JOIN LATERAL (
        SELECT
          string_agg(tz.id_transaksi, ', ' ORDER BY tz.id) FILTER (
            WHERE tz.id_transaksi IS NOT NULL AND tz.id_transaksi <> ''
          ) AS id_transaksi_zains,
          (array_agg(tz.id_donatur ORDER BY tz.id) FILTER (
            WHERE tz.id_donatur IS NOT NULL AND tz.id_donatur <> ''
          ))[1] AS id_donatur_zains
        FROM transactions_to_zains tz
        WHERE tz.transaction_id = t.id
      ) zains ON TRUE
      WHERE ${whereSql}
    `;

      const filterParams = params.slice(0, limitIdx - 1);

      let orderByClause = "ORDER BY t.id ASC";
      if (sort === "trx_no_asc") {
        orderByClause = "ORDER BY NULLIF(regexp_replace(t.trx_no, '\\\\D', '', 'g'), '')::numeric ASC NULLS LAST, t.id ASC";
      } else if (sort === "trx_no_desc") {
        orderByClause = "ORDER BY NULLIF(regexp_replace(t.trx_no, '\\\\D', '', 'g'), '')::numeric DESC NULLS LAST, t.id DESC";
      }

      const [transactions, countResultRaw] = await Promise.all([
        client(
          `
        SELECT 
          t.*,
          c.name AS clinic_name,
          mp.name AS master_poly_name,
          mit.name AS master_insurance_name,
          zains.id_transaksi_zains,
          zains.id_donatur_zains
        ${baseFromWhere}
        ${orderByClause}
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
        `,
          params,
        ),
        client(
          `
        SELECT COUNT(*) AS total
        ${baseFromForCount}
        `,
          filterParams,
        ),
      ]);

      const countResult = Array.isArray(countResultRaw)
        ? countResultRaw[0]
        : countResultRaw;

      return {
        transactions: Array.isArray(transactions) ? transactions : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      };
    } catch (error) {
      console.error("Error fetching transactions:", error);
      return {
        transactions: [],
        total: 0,
        page,
        limit,
      };
    }
  },
);

export const getTransactionsByPatient = cache(
  async (
    patientId?: number,
    ermNo?: string,
    page: number = 1,
    limit: number = 10,
  ) => {
    try {
      const offset = (page - 1) * limit;

      if (patientId) {
        // Parallel fetching untuk performa maksimal
        const [transactions, countResultRaw] = await Promise.all([
          sql`
          SELECT 
            t.*,
            c.name as clinic_name
          FROM transactions t
          JOIN clinics c ON c.id = t.clinic_id
          WHERE t.patient_id = ${patientId}
          ORDER BY t.trx_date DESC, t.trx_time DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
          sql`
          SELECT COUNT(*) as total
          FROM transactions t
          WHERE t.patient_id = ${patientId}
        `,
        ]);
        const countResult = Array.isArray(countResultRaw)
          ? countResultRaw[0]
          : countResultRaw;

        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        };
      } else if (ermNo) {
        // Parallel fetching untuk performa maksimal
        const [transactions, countResultRaw] = await Promise.all([
          sql`
          SELECT 
            t.*,
            c.name as clinic_name
          FROM transactions t
          JOIN clinics c ON c.id = t.clinic_id
          WHERE t.erm_no = ${ermNo}
          ORDER BY t.trx_date DESC, t.trx_time DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
          sql`
          SELECT COUNT(*) as total
          FROM transactions t
          WHERE t.erm_no = ${ermNo}
        `,
        ]);
        const countResult = Array.isArray(countResultRaw)
          ? countResultRaw[0]
          : countResultRaw;

        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        };
      }

      return {
        transactions: [],
        total: 0,
        page,
        limit,
      };
    } catch (error) {
      console.error("Error fetching transactions by patient:", error);
      return {
        transactions: [],
        total: 0,
        page,
        limit,
      };
    }
  },
);

export const getTransactionById = cache(async (id: string | number) => {
  try {
    const transactionId = typeof id === "string" ? parseInt(id) : id;
    const transactionRaw = await sql`
      SELECT 
        t.*,
        c.name as clinic_name,
        c.location as clinic_location,
        p.full_name as patient_full_name,
        p.first_visit_at,
        p.visit_count
      FROM transactions t
      JOIN clinics c ON c.id = t.clinic_id
      LEFT JOIN patients p ON p.id = t.patient_id
      WHERE t.id = ${transactionId}
    `;
    const transaction = Array.isArray(transactionRaw)
      ? transactionRaw[0]
      : transactionRaw;
    return transaction || null;
  } catch (error) {
    console.error("Error fetching transaction:", error);
    return null;
  }
});

export const getTransactionStats = cache(
  async (
    search?: string,
    clinicId?: number,
    dateFrom?: string,
    dateTo?: string,
    polyId?: number,
    insuranceTypeId?: number,
    zainsSynced?: "all" | "synced" | "pending",
  ) => {
    try {
      const client = getSqlClient();

      const trimmedSearch =
        search && search.trim() !== "" ? search.trim() : undefined;
      const validDateFrom =
        dateFrom && dateFrom.trim() !== "" ? dateFrom : undefined;
      const validDateTo = dateTo && dateTo.trim() !== "" ? dateTo : undefined;

      const whereClauses: string[] = [];
      const params: any[] = [];
      let paramIndex = 0;

      // Filter klinik
      if (clinicId) {
        paramIndex++;
        params.push(clinicId);
        whereClauses.push(`t.clinic_id = $${paramIndex}`);
      }

      // Filter search (sama dengan getTransactions: termasuk nik)
      if (trimmedSearch) {
        paramIndex++;
        params.push(`%${trimmedSearch}%`);
        const idx = paramIndex;
        whereClauses.push(
          `(t.trx_no ILIKE $${idx} OR t.patient_name ILIKE $${idx} OR t.erm_no ILIKE $${idx} OR t.nik ILIKE $${idx} OR EXISTS (SELECT 1 FROM transactions_to_zains tz WHERE tz.transaction_id = t.id AND (tz.id_transaksi ILIKE $${idx} OR tz.id_donatur ILIKE $${idx})))`,
        );
      }

      // Filter tanggal (tanpa DATE(kolom))
      if (validDateFrom && validDateTo) {
        paramIndex++;
        const fromIdx = paramIndex;
        params.push(validDateFrom);

        paramIndex++;
        const toIdx = paramIndex;
        params.push(validDateTo);

        whereClauses.push(
          `t.trx_date >= $${fromIdx}::date AND t.trx_date <= $${toIdx}::date`,
        );
      } else if (validDateFrom) {
        paramIndex++;
        params.push(validDateFrom);
        whereClauses.push(`t.trx_date >= $${paramIndex}::date`);
      } else if (validDateTo) {
        paramIndex++;
        params.push(validDateTo);
        whereClauses.push(`t.trx_date <= $${paramIndex}::date`);
      }

      // Filter poli
      if (polyId) {
        paramIndex++;
        params.push(polyId);
        whereClauses.push(`t.poly_id = $${paramIndex}`);
      }

      // Filter jenis asuransi
      if (insuranceTypeId) {
        paramIndex++;
        params.push(insuranceTypeId);
        whereClauses.push(`t.insurance_type_id = $${paramIndex}`);
      }

      // Filter sync Zains
      if (zainsSynced === "synced") {
        whereClauses.push("t.zains_synced = true");
      } else if (zainsSynced === "pending") {
        whereClauses.push("(t.zains_synced = false OR t.zains_synced IS NULL)");
      }

      const whereSql =
        whereClauses.length > 0 ? whereClauses.join(" AND ") : "TRUE";

      const statsRaw = await client(
        `
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN t.zains_synced = true THEN 1 END) as synced_count,
        COUNT(CASE WHEN (t.zains_synced = false OR t.zains_synced IS NULL) THEN 1 END) as pending_count,
        COALESCE(SUM(t.paid_total), 0) as total_revenue,
        COALESCE(SUM(t.covered_total), 0) as total_jaminan,
        COALESCE(SUM(t.bill_total), 0) as total_tagihan
      FROM transactions t
      WHERE ${whereSql}
      `,
        params,
      );

      const stats = Array.isArray(statsRaw) ? statsRaw[0] : statsRaw;

      return {
        totalTransactions: Number((stats as any)?.total_transactions || 0),
        syncedCount: Number((stats as any)?.synced_count || 0),
        pendingCount: Number((stats as any)?.pending_count || 0),
        totalRevenue: Number((stats as any)?.total_revenue || 0),
        totalJaminan: Number((stats as any)?.total_jaminan || 0),
        totalTagihan: Number((stats as any)?.total_tagihan || 0),
      };
    } catch (error) {
      console.error("Error fetching transaction stats:", error);
      return {
        totalTransactions: 0,
        syncedCount: 0,
        pendingCount: 0,
        totalRevenue: 0,
        totalJaminan: 0,
        totalTagihan: 0,
      };
    }
  },
);

/**
 * Server action: pastikan patient/donatur untuk suatu transaksi sudah tersinkron ke Zains.
 * - Jika patient sudah punya id_donatur_zains: hanya propagate ke transactions_to_zains yang masih kosong.
 * - Jika belum: panggil syncPatientToZains (langsung hit API Zains, bukan via workflow/QStash).
 */
export async function syncDonaturForTransaction(
  transactionId: number,
): Promise<{
  success: boolean;
  id_donatur?: string;
  patientId?: number;
  skipped?: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const rows = await sql`
      SELECT 
        p.*,
        t.id AS transaction_id
      FROM transactions t
      JOIN patients p ON p.id = t.patient_id
      WHERE t.id = ${transactionId}
      LIMIT 1
    `;

    const row: any = Array.isArray(rows) ? rows[0] : rows;

    if (!row) {
      return {
        success: false,
        error: "Transaksi atau pasien tidak ditemukan",
      };
    }

    const patientId = Number(row.id);
    const existingIdDonatur: string | null =
      row.id_donatur_zains && row.id_donatur_zains !== ""
        ? String(row.id_donatur_zains)
        : null;

    if (existingIdDonatur) {
      // Pastikan semua baris transactions_to_zains untuk patient ini ikut terisi id_donatur
      await sql`
        UPDATE transactions_to_zains tz
        SET id_donatur = ${existingIdDonatur}
        FROM transactions t
        WHERE tz.transaction_id = t.id
          AND t.patient_id = ${patientId}
          AND (tz.id_donatur IS NULL OR tz.id_donatur = '')
      `;

      return {
        success: true,
        id_donatur: existingIdDonatur,
        patientId,
        skipped: true,
        message:
          "Patient sudah memiliki id_donatur_zains, hanya meng-update transaksi yang belum terisi.",
      };
    }

    const result = await syncPatientToZains(row);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Gagal sync donatur ke Zains",
        patientId: result.patientId,
      };
    }

    return {
      success: true,
      id_donatur: result.id_donatur,
      patientId: result.patientId,
      message: "Berhasil sync donatur ke Zains",
    };
  } catch (error: any) {
    console.error("Error syncDonaturForTransaction:", error);
    return {
      success: false,
      error: error?.message || "Error tak terduga saat sync donatur ke Zains",
    };
  }
}

/**
 * List transactions_to_zains dengan filter dan pagination (untuk halaman Transaksi ke Zains).
 * Filter: clinicId (RBAC), dateFrom/dateTo (tz.tgl_transaksi), search (id_transaksi, id_donatur, nama_pasien, no_erm, clinic name, program name).
 */
export const getTransactionsToZainsList = cache(
  async (
    search?: string,
    clinicId?: number,
    dateFrom?: string,
    dateTo?: string,
    page: number = 1,
    limit: number = 10,
    zainsSynced?: "all" | "synced" | "pending",
    paymentMethod?: string
  ) => {
    try {
      const offset = (page - 1) * limit;
      const client = getSqlClient();

      const trimmedSearch =
        search && search.trim() !== "" ? search.trim() : undefined;
      const validDateFrom =
        dateFrom && dateFrom.trim() !== "" ? dateFrom : undefined;
      const validDateTo = dateTo && dateTo.trim() !== "" ? dateTo : undefined;
      const normalizedMethod =
        paymentMethod && paymentMethod.trim() !== "" && paymentMethod !== "all"
          ? paymentMethod.trim()
          : undefined;

      const whereClauses: string[] = [];
      const params: any[] = [];
      let paramIndex = 0;

      if (clinicId) {
        paramIndex++;
        params.push(clinicId);
        whereClauses.push(`t.clinic_id = $${paramIndex}`);
      }

      if (normalizedMethod) {
        paramIndex++;
        params.push(`%${normalizedMethod}%`);
        whereClauses.push(`UPPER(t.payment_method) LIKE UPPER($${paramIndex})`);
      }

      if (trimmedSearch) {
        paramIndex++;
        params.push(`%${trimmedSearch}%`);
        const idx = paramIndex;
        whereClauses.push(
          `(t.trx_no ILIKE $${idx} OR tz.id_transaksi ILIKE $${idx} OR tz.id_program ILIKE $${idx} OR mtc.name ILIKE $${idx} OR tz.id_kantor ILIKE $${idx} OR c.name ILIKE $${idx} OR tz.id_donatur ILIKE $${idx} OR tz.nama_pasien ILIKE $${idx} OR tz.no_erm ILIKE $${idx} OR tz.id_rekening ILIKE $${idx} OR c.id_rekening ILIKE $${idx} OR c.kode_coa ILIKE $${idx} OR CAST(tz.nominal_transaksi AS TEXT) LIKE $${idx})`
        );
      }

      if (validDateFrom && validDateTo) {
        paramIndex++;
        params.push(validDateFrom);
        const fromIdx = paramIndex;
        paramIndex++;
        params.push(validDateTo);
        const toIdx = paramIndex;
        whereClauses.push(
          `tz.tgl_transaksi >= $${fromIdx}::date AND tz.tgl_transaksi <= $${toIdx}::date`
        );
      } else if (validDateFrom) {
        paramIndex++;
        params.push(validDateFrom);
        whereClauses.push(`tz.tgl_transaksi >= $${paramIndex}::date`);
      } else if (validDateTo) {
        paramIndex++;
        params.push(validDateTo);
        whereClauses.push(`tz.tgl_transaksi <= $${paramIndex}::date`);
      }

      if (zainsSynced === "synced") {
        whereClauses.push("tz.synced = true");
      } else if (zainsSynced === "pending") {
        whereClauses.push("(tz.synced = false OR tz.synced IS NULL)");
      }

      const whereSql =
        whereClauses.length > 0 ? whereClauses.join(" AND ") : "TRUE";

      paramIndex++;
      const limitIdx = paramIndex;
      params.push(limit);
      paramIndex++;
      const offsetIdx = paramIndex;
      params.push(offset);

      const baseFromWhere = `
      FROM transactions_to_zains tz
      JOIN transactions t ON t.id = tz.transaction_id
      JOIN clinics c ON c.id = t.clinic_id
      LEFT JOIN master_target_categories mtc ON mtc.id_program_zains = tz.id_program
      WHERE ${whereSql}
    `;
      const filterParams = params.slice(0, limitIdx - 1);

      const [rows, countResultRaw] = await Promise.all([
        client(
          `
        SELECT 
          tz.*,
          t.trx_no,
          t.trx_date,
          t.payment_method,
          c.name AS clinic_name,
          c.id_rekening AS clinic_id_rekening,
          c.kode_coa AS clinic_kode_coa,
          mtc.name AS program_name
        ${baseFromWhere}
        ORDER BY tz.tgl_transaksi DESC NULLS LAST, tz.id DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
        `,
          params
        ),
        client(
          `
        SELECT COUNT(*) AS total
        ${baseFromWhere}
        `,
          filterParams
        ),
      ]);

      const countResult = Array.isArray(countResultRaw)
        ? countResultRaw[0]
        : countResultRaw;
      return {
        rows: Array.isArray(rows) ? rows : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      };
    } catch (error) {
      console.error("Error fetching transactions to zains list:", error);
      return { rows: [], total: 0, page, limit };
    }
  }
);

/**
 * Statistik agregat untuk list transactions_to_zains (filter sama dengan getTransactionsToZainsList).
 */
export const getTransactionsToZainsStats = cache(
  async (
    search?: string,
    clinicId?: number,
    dateFrom?: string,
    dateTo?: string,
    zainsSynced?: "all" | "synced" | "pending",
    paymentMethod?: string
  ) => {
    try {
      const client = getSqlClient();
      const trimmedSearch =
        search && search.trim() !== "" ? search.trim() : undefined;
      const validDateFrom =
        dateFrom && dateFrom.trim() !== "" ? dateFrom : undefined;
      const validDateTo = dateTo && dateTo.trim() !== "" ? dateTo : undefined;
      const normalizedMethod =
        paymentMethod && paymentMethod.trim() !== "" && paymentMethod !== "all"
          ? paymentMethod.trim()
          : undefined;

      const whereClauses: string[] = [];
      const params: any[] = [];
      let paramIndex = 0;

      if (clinicId) {
        paramIndex++;
        params.push(clinicId);
        whereClauses.push(`t.clinic_id = $${paramIndex}`);
      }
      if (normalizedMethod) {
        paramIndex++;
        params.push(`%${normalizedMethod}%`);
        whereClauses.push(`UPPER(t.payment_method) LIKE UPPER($${paramIndex})`);
      }
      if (trimmedSearch) {
        paramIndex++;
        params.push(`%${trimmedSearch}%`);
        const idx = paramIndex;
        whereClauses.push(
          `(t.trx_no ILIKE $${idx} OR tz.id_transaksi ILIKE $${idx} OR tz.id_program ILIKE $${idx} OR mtc.name ILIKE $${idx} OR tz.id_kantor ILIKE $${idx} OR c.name ILIKE $${idx} OR tz.id_donatur ILIKE $${idx} OR tz.nama_pasien ILIKE $${idx} OR tz.no_erm ILIKE $${idx} OR tz.id_rekening ILIKE $${idx} OR c.id_rekening ILIKE $${idx} OR c.kode_coa ILIKE $${idx} OR CAST(tz.nominal_transaksi AS TEXT) LIKE $${idx})`
        );
      }
      if (validDateFrom && validDateTo) {
        paramIndex++;
        params.push(validDateFrom);
        const fromIdx = paramIndex;
        paramIndex++;
        params.push(validDateTo);
        const toIdx = paramIndex;
        whereClauses.push(
          `tz.tgl_transaksi >= $${fromIdx}::date AND tz.tgl_transaksi <= $${toIdx}::date`
        );
      } else if (validDateFrom) {
        paramIndex++;
        params.push(validDateFrom);
        whereClauses.push(`tz.tgl_transaksi >= $${paramIndex}::date`);
      } else if (validDateTo) {
        paramIndex++;
        params.push(validDateTo);
        whereClauses.push(`tz.tgl_transaksi <= $${paramIndex}::date`);
      }
      if (zainsSynced === "synced") {
        whereClauses.push("tz.synced = true");
      } else if (zainsSynced === "pending") {
        whereClauses.push("(tz.synced = false OR tz.synced IS NULL)");
      }

      const whereSql =
        whereClauses.length > 0 ? whereClauses.join(" AND ") : "TRUE";

      const statsRaw = await client(
        `
      SELECT 
        COUNT(*) AS total_records,
        COUNT(CASE WHEN tz.synced = true THEN 1 END) AS synced_count,
        COUNT(CASE WHEN tz.synced = false OR tz.synced IS NULL THEN 1 END) AS pending_count,
        COALESCE(SUM(tz.nominal_transaksi), 0) AS total_nominal
      FROM transactions_to_zains tz
      JOIN transactions t ON t.id = tz.transaction_id
      JOIN clinics c ON c.id = t.clinic_id
      LEFT JOIN master_target_categories mtc ON mtc.id_program_zains = tz.id_program
      WHERE ${whereSql}
      `,
        params
      );
      const stats = Array.isArray(statsRaw) ? statsRaw[0] : statsRaw;
      return {
        totalRecords: Number((stats as any)?.total_records || 0),
        syncedCount: Number((stats as any)?.synced_count || 0),
        pendingCount: Number((stats as any)?.pending_count || 0),
        totalNominal: Number((stats as any)?.total_nominal || 0),
      };
    } catch (error) {
      console.error("Error fetching transactions to zains stats:", error);
      return {
        totalRecords: 0,
        syncedCount: 0,
        pendingCount: 0,
        totalNominal: 0,
      };
    }
  }
);

export const getTransactionsToZains = cache(
  async (transactionId: number, dateFrom?: string, dateTo?: string) => {
    try {
      let query = sql`
      SELECT 
        tz.*,
        t.trx_no,
        t.trx_date,
        c.name as clinic_name,
        mtc.name as program_name
      FROM transactions_to_zains tz
      JOIN transactions t ON t.id = tz.transaction_id
      JOIN clinics c ON c.id = t.clinic_id
      LEFT JOIN master_target_categories mtc ON mtc.id_program_zains = tz.id_program
      WHERE tz.transaction_id = ${transactionId}
    `;

      if (dateFrom) {
        query = sql`
        SELECT 
          tz.*,
          t.trx_no,
          t.trx_date,
          c.name as clinic_name,
          mtc.name as program_name
        FROM transactions_to_zains tz
        JOIN transactions t ON t.id = tz.transaction_id
        JOIN clinics c ON c.id = t.clinic_id
        LEFT JOIN master_target_categories mtc ON mtc.id_program_zains = tz.id_program
        WHERE tz.transaction_id = ${transactionId}
          AND tz.tgl_transaksi >= ${dateFrom}
      `;
      }

      if (dateTo) {
        query = sql`
        SELECT 
          tz.*,
          t.trx_no,
          t.trx_date,
          c.name as clinic_name,
          mtc.name as program_name
        FROM transactions_to_zains tz
        JOIN transactions t ON t.id = tz.transaction_id
        JOIN clinics c ON c.id = t.clinic_id
        LEFT JOIN master_target_categories mtc ON mtc.id_program_zains = tz.id_program
        WHERE tz.transaction_id = ${transactionId}
          ${dateFrom ? sql`AND tz.tgl_transaksi >= ${dateFrom}` : sql``}
          AND tz.tgl_transaksi <= ${dateTo}
      `;
      }

      const result = await query;
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error("Error fetching transactions to zains:", error);
      return [];
    }
  },
);

/**
 * Server action: sync transactions_to_zains untuk satu transaction_id ke API Zains (sequential).
 * Dipanggil dari modal Detail Transaksi ke Zains.
 */
export async function syncTransactionsToZainsFromModal(
  transactionId: number,
): Promise<{
  success: boolean;
  total: number;
  successCount: number;
  failedCount: number;
  message?: string;
  error?: string;
  results?: Array<{
    transactionsToZainsId: number;
    success: boolean;
    id_transaksi?: string;
    error?: string;
  }>;
}> {
  try {
    const result =
      await syncTransactionsToZainsByTransactionIdSequential(transactionId);
    if (result.total === 0) {
      return {
        success: true,
        total: 0,
        successCount: 0,
        failedCount: 0,
        message:
          "Semua baris sudah terkirim ke Zains atau tidak ada data pending.",
      };
    }
    return {
      success: result.failed === 0,
      total: result.total,
      successCount: result.success,
      failedCount: result.failed,
      message:
        result.failed === 0
          ? `${result.success} baris berhasil dikirim ke Zains`
          : `${result.success} berhasil, ${result.failed} gagal`,
      results: result.results.map((r) => ({
        transactionsToZainsId: r.transactionsToZainsId,
        success: r.success,
        id_transaksi: r.id_transaksi,
        error: r.error,
      })),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal sync ke Zains";
    console.error("syncTransactionsToZainsFromModal:", error);
    return {
      success: false,
      total: 0,
      successCount: 0,
      failedCount: 0,
      error: message,
    };
  }
}

/**
 * Hapus transaksi beserta cascade ke transactions_to_zains.
 * Urutan: hapus dulu transactions_to_zains, lalu transactions.
 */
export async function deleteTransaction(
  transactionId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    await sql`DELETE FROM transactions_to_zains WHERE transaction_id = ${transactionId}`;
    await sql`DELETE FROM transactions WHERE id = ${transactionId}`;
    return { success: true };
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Gagal menghapus transaksi",
    };
  }
}
