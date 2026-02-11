# -*- coding: utf-8 -*-
"""
WO_S1000D_LINK.py
-----------------
Maximo Automation Script: Append S1000D IPS Viewer URL to Work Order Long Description.

Trigger:  Object Launch Point on WORKORDER object.
Purpose:  When a Work Order is saved, appends a link to the IPS viewer (S1000D Data Module
          and model context) to the long description, so technicians can open the correct
          technical documentation from the WO.

URL format: https://ips-viewer.skoda.cz/view?dmc={DMC}&model={MODEL}
  - DMC:  From Job Plan custom attribute PLUS_DMC (S1000D Data Module Code).
  - MODEL: From associated Asset custom attribute PLUS_MODEL_ID.

Compatible: Jython / Python 2.7 (IBM Maximo).
"""

# ---------------------------------------------------------------------------
# 1. Get the current Work Order (MBO from launch point context)
# ---------------------------------------------------------------------------
# In an Object Launch Point on WORKORDER, 'mbo' is the WORKORDER MBO.
workOrder = mbo
if workOrder is None:
    # Defensive: should not happen when launch point is on WORKORDER
    raise ValueError("WO_S1000D_LINK: No Work Order MBO in context.")

# ---------------------------------------------------------------------------
# 2. Get the associated Job Plan (JOBPLAN relationship)
# ---------------------------------------------------------------------------
jobPlanSet = workOrder.getMboSet("JOBPLAN")
jobPlan = None
if jobPlanSet is not None and not jobPlanSet.isEmpty():
    jobPlan = jobPlanSet.getMbo(0)

if jobPlan is None:
    # No Job Plan linked to this WO; skip URL generation
    pass
else:
    # -----------------------------------------------------------------------
    # 3. Read S1000D Data Module Code (DMC) from the Job Plan
    # -----------------------------------------------------------------------
    plusDmc = None
    try:
        plusDmc = jobPlan.getString("PLUS_DMC")
    except Exception:
        plusDmc = None
    if plusDmc is None:
        plusDmc = ""
    plusDmc = plusDmc.strip()

    # -----------------------------------------------------------------------
    # 4. Read PLUS_MODEL_ID from the associated ASSET
    # -----------------------------------------------------------------------
    plusModelId = ""
    assetSet = workOrder.getMboSet("ASSET")
    if assetSet is not None and not assetSet.isEmpty():
        assetMbo = assetSet.getMbo(0)
        if assetMbo is not None:
            try:
                plusModelId = assetMbo.getString("PLUS_MODEL_ID")
            except Exception:
                plusModelId = ""
            if plusModelId is None:
                plusModelId = ""
            plusModelId = plusModelId.strip()

    # -----------------------------------------------------------------------
    # 5. Construct the IPS Viewer URL (only if we have at least DMC)
    # -----------------------------------------------------------------------
    if plusDmc:
        # Build URL; model is optional but recommended for correct context
        baseUrl = "https://ips-viewer.skoda.cz/view"
        url = baseUrl + "?dmc=" + plusDmc
        if plusModelId:
            url = url + "&model=" + plusModelId

        # -------------------------------------------------------------------
        # 6. Append URL to Work Order long description if not already present
        # -------------------------------------------------------------------
        longDescSet = workOrder.getMboSet("DESCRIPTION_LONGDESCRIPTION")
        if longDescSet is not None and not longDescSet.isEmpty():
            longDescMbo = longDescSet.getMbo(0)
            if longDescMbo is not None:
                existingText = ""
                try:
                    existingText = longDescMbo.getString("DESCRIPTION")
                except Exception:
                    existingText = ""
                if existingText is None:
                    existingText = ""
                # Avoid duplicating the same URL
                if url not in existingText:
                    separator = "\n" if existingText else ""
                    newText = existingText + separator + url
                    longDescMbo.setValue("DESCRIPTION", newText)
