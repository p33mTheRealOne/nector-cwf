'use client';

import * as React from 'react';
import Image from 'next/image';

const SOL_PRICE = 135;

function usdToSol(numStr: string) {
  const usd = Number(numStr || 0);
  const sol = usd / SOL_PRICE;
  return `${sol.toFixed(2)} SOL`;
}

function formatUsdShort(numStr: string) {
  const n = Number(numStr || 0);

  if (n >= 1_000_000_000)
    return `$${(n / 1_000_000_000).toFixed(1)}B`;

  if (n >= 1_000_000)
    return `$${(n / 1_000_000).toFixed(1)}M`;

  if (n >= 1_000)
    return `$${(n / 1_000).toFixed(1)}K`;

  return `$${n.toFixed(1)}`;
}

export default function EscrowItemInfo({
  type,
  draft,
  setDraft,
  onNext,
  onBack,
  onClose,
}: {
  type: 'physical' | 'digital';
  draft: any;
  setDraft: React.Dispatch<React.SetStateAction<any>>;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}) {

  const fileRef = React.useRef<HTMLInputElement | null>(null);

  // track preview URL we created so we can revoke the old one when replacing
  const lastPreviewRef = React.useRef<string | null>(null);

  function onPickFile(f?: File) {
    if (!f) return;

    // revoke previous preview we created (if any)
    if (lastPreviewRef.current) {
      try { URL.revokeObjectURL(lastPreviewRef.current); } catch {}
      lastPreviewRef.current = null;
    }

    const url = URL.createObjectURL(f);
    lastPreviewRef.current = url;

    setDraft((d:any) => ({
      ...d,
      imageFile: f,
      imagePreview: url,
    }));
  }

  const canNext =
    draft.imagePreview &&        // ⭐ บังคับต้องมีรูป
    draft.description?.trim() &&
    draft.price &&
    (type === 'physical'
      ? !!draft.shipDate
      : draft.shipTime > 0);

  const today = new Date();
  const minDate = today.toISOString().split("T")[0];

  const max = new Date();
  max.setMonth(max.getMonth() + 1);
  const maxDate = max.toISOString().split("T")[0];

  function formatDisplay(dateStr: string) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  const dateRef = React.useRef<HTMLInputElement | null>(null);

  const [showInfo, setShowInfo] = React.useState(false);
  const infoRef = React.useRef<HTMLDivElement | null>(null);

  // ปิด tooltip เมื่อคลิกนอกพื้นที่
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setShowInfo(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* top bar */}
      <div className="h-[91px] border-b border-white/10 flex items-center px-4 md:px-6 min-w-0">
        {/* LEFT */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="h-10 w-10 rounded-full hover:bg-white/5 grid place-items-center text-white/80 shrink-0"
            title="Back"
          >
            <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
          </button>

          <div className="text-white text-[18px] font-medium truncate">
            Create Escrow order
          </div>
        </div>

        {/* RIGHT */}
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 grid place-items-center text-white/80 shrink-0"
          title="Close"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>
      {/* body */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-[720px]">
          {/* title */}
          <div className="text-center text-white text-[27px] font-medium mb-8">
            Insert item info
          </div>

          {/* layout ตามรูป: ซ้ายรูป / ขวาฟอร์ม */}
          <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-8 md:gap-10 items-start">
            {/* left: picture */}
            <div className="mt-5 flex flex-col items-center">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative w-[138px] h-[138px] rounded-[18px] bg-[#262626] hover:bg-[#303030] transition overflow-hidden"
                title="Upload"
              >
                {draft.imagePreview ? (
                  <img
                    src={draft.imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center">
                    <Image
                      src="/image-square-svgrepo-com.svg"
                      width={50}
                      height={50}
                      alt="Item’s Picture"
                    />
                  </div>
                )}
              </button>

              {/* hidden input */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0])}
              />

              <div className="mt-3 text-[#A6A6A6] text-[14px]">Item’s Picture</div>
            </div>

            {/* right: inputs */}
            <div>
              <label className="block text-white text-[14px] font-medium mb-2">
                Item’s Description
              </label>

              <div className="relative">
                <Image
                  src="/document-ui-description-svgrepo-com.svg"
                  width={17}
                  height={17}
                  alt="document"
                  className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                />

                <input
                  value={draft.description}
                  onChange={(e) =>
                    setDraft((d:any)=>({...d, description:e.target.value}))
                  }
                  placeholder="Describe your Item..."
                  className="w-full h-[46px] rounded-[8px] bg-[#222222]
                            text-white/90 outline-none
                            pl-11 pr-4
                            focus:ring-2 focus:ring-[#2FE4E4]/40"
                />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-6">
                <div>
                  {type === "physical" ? (
                    // ================= PHYSICAL =================
                    <div>
                      <div className="flex items-center gap-2 mb-2 relative">
                        <label className="text-white text-[14px] font-medium">
                          Shipping date
                        </label>

                        <div
                          ref={infoRef}
                          className="relative"
                          onMouseEnter={() => setShowInfo(true)}
                          onMouseLeave={() => setShowInfo(false)}
                        >
                          <Image
                            src="/question-circle-svgrepo-com.svg"
                            width={18}
                            height={18}
                            alt="info"
                            onClick={() => setShowInfo((prev) => !prev)}
                            className="cursor-pointer opacity-70 hover:opacity-100"
                          />

                          {showInfo && (
                            <div
                              className="absolute z-50
                                        left-1/2 -translate-x-1/2
                                        top-7
                                        w-[260px] p-3
                                        rounded-[8px]
                                        bg-[#1A1A1A]
                                        text-white text-[12px]
                                        shadow-xl
                                        border border-white/10"
                            >
                              You must ship the item before this date. Otherwise, the buyer will be refunded and you will lose your bond.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="relative">
                        <Image
                          src="/calender-svgrepo-com.svg"
                          width={18}
                          height={18}
                          alt="calendar"
                          className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                        />

                        <input
                          ref={dateRef}
                          type="date"
                          min={minDate}
                          max={maxDate}
                          value={draft.shipDate}
                          onChange={(e)=>
                            setDraft((d:any)=>({...d, shipDate:e.target.value}))
                          }
                          onKeyDown={(e) => e.preventDefault()}
                          onPaste={(e) => e.preventDefault()}
                          onClick={() => dateRef.current?.showPicker?.()}
                          className="w-full h-[46px] rounded-[8px] bg-[#222222]
                                    text-white/90 outline-none
                                    pl-11 pr-4
                                    focus:ring-2 focus:ring-[#2FE4E4]/40
                                    appearance-none"
                        />
                      </div>
                    </div>
                  ) : (
                    // ================= DIGITAL =================
                    <div>
                      <div className="flex items-center gap-2 mb-2 relative">
                        <label className="text-white text-[14px] font-medium">
                          Shipping time (hours)
                        </label>

                        <div
                          ref={infoRef}
                          className="relative"
                          onMouseEnter={() => setShowInfo(true)}
                          onMouseLeave={() => setShowInfo(false)}
                        >
                          <Image
                            src="/question-circle-svgrepo-com.svg"
                            width={18}
                            height={18}
                            alt="info"
                            onClick={() => setShowInfo((prev) => !prev)}
                            className="cursor-pointer opacity-70 hover:opacity-100"
                          />

                          {showInfo && (
                            <div
                              className="absolute z-50
                                        left-1/2 -translate-x-1/2
                                        top-7
                                        w-[260px] p-3
                                        rounded-[8px]
                                        bg-[#1A1A1A]
                                        text-white text-[12px]
                                        shadow-xl
                                        border border-white/10"
                            >
                              You must deliver the item within this many hours.
                              If not, the buyer will be refunded automatically and you will lose your bond
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="relative flex items-center">
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((d: any) => {
                              const current = Number(d.shipTime || 1);
                              const next = Math.max(1, current - 1); // ✅ ห้ามต่ำกว่า 1
                              return { ...d, shipTime: String(next) };
                            })
                          }
                          className="absolute left-2 text-white text-lg px-2"
                        >
                          −
                        </button>

                        <input
                          type="text"
                          inputMode="numeric"
                          value={draft.shipTime}
                          onChange={(e)=>{
                            let v = e.target.value.replace(/\D/g,"");
                            if(!v){ setDraft((d:any)=>({...d, shipTime:''})); return;}
                            let n = Math.max(1, Math.min(48, Number(v)));
                            setDraft((d:any)=>({...d, shipTime:String(n)}));
                          }}
                          onKeyDown={(e) => {
                            if (e.key.length === 1 && !/[0-9]/.test(e.key)) {
                              e.preventDefault();
                            }
                          }}
                          className="w-full h-[46px] rounded-[8px] bg-[#222222]
                                    text-white/90 outline-none
                                    text-center
                                    pl-10 pr-10
                                    focus:ring-2 focus:ring-[#2FE4E4]/40"
                          placeholder="1-48"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setDraft((d: any) => {
                              const current = Number(d.shipTime || 0);
                              const next = Math.min(48, current + 1); // ✅ ห้ามเกิน 48
                              return { ...d, shipTime: String(next) };
                            })
                          }
                          className="absolute right-2 text-white text-lg px-2"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-white text-[14px] font-medium mb-2">
                    Item’s Price
                  </label>

                  <div className="relative">
                    {/* dollar icon */}
                    <Image
                      src="/dollar-svgrepo-com.svg"
                      width={24}
                      height={24}
                      alt="dollar"
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    />

                    <input
                      type="text"
                      inputMode="numeric"
                      value={draft.price}
                      onChange={(e)=>{
                        const onlyNumbers = e.target.value.replace(/\D/g,"");
                        setDraft((d:any)=>({...d, price:onlyNumbers}))
                      }}
                      onKeyDown={(e) => {
                        if (
                          e.key.length === 1 &&
                          !/[0-9]/.test(e.key)
                        ) {
                          e.preventDefault();
                        }
                      }}
                      className="w-full h-[46px] rounded-[8px] bg-[#222222]
                                text-white/90 outline-none
                                pl-11 pr-4
                                focus:ring-2 focus:ring-[#2FE4E4]/40"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* next button */}
          <button
            disabled={!canNext}
            onClick={onNext}
            className={`mt-8 w-full h-[46px] rounded-[10px] font-semibold
            ${canNext ? "bg-[#2FE4E4] text-black" : "bg-[#136262] text-black cursor-not-allowed"}`}
          >
            Next
          </button>

          {/* เอาไว้ debug ได้ ถ้าไม่ต้องการลบทิ้ง */}
          <div className="mt-3 text-center text-white/30 text-[12px]">Type: {type}</div>
        </div>
      </div>
    </div>
  );
}

export function EscrowNameOrder({
  draft,
  setDraft,
  onBack,
  onClose,
  onNext,
}: any) {
  const canNext = draft.orderName?.trim().length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* top bar */}
      <div className="h-[91px] border-b border-white/10 flex items-center px-4 md:px-6 min-w-0">
        {/* LEFT */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="h-10 w-10 rounded-full hover:bg-white/5 grid place-items-center text-white/80 shrink-0"
            title="Back"
          >
            <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
          </button>

          <div className="text-white text-[18px] font-medium truncate">
            Create Escrow order
          </div>
        </div>

        {/* RIGHT */}
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 grid place-items-center text-white/80 shrink-0"
          title="Close"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        {/* 👇 รูปจากหน้าก่อน */}
        <img
          src={draft.imagePreview || "/image-square-svgrepo-com.svg"}
          className="w-[150px] h-[150px] rounded-xl object-cover"
        />

        <div className="text-white text-3xl">Name this Order</div>

        <input
          value={draft.orderName}
          onChange={(e)=>setDraft((d:any)=>({...d,orderName:e.target.value}))}
          className="w-full max-w-[420px] h-[46px] rounded-[10px] bg-[#2f2f2f] text-white/90 outline-none px-4 focus-within:ring-2 focus-within:ring-[#2FE4E4]/40"
        />

        <button
          disabled={!canNext}
          onClick={onNext}   // ⭐ เพิ่ม
          className={`w-[420px] h-[46px] rounded-[10px] font-semibold
            ${canNext ? "bg-[#26D9D9] text-black" : "bg-[#136262] text-black cursor-not-allowed"}`}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function EscrowPreview({
  draft,
  type,
  onBack,
  onClose,
}: any) {
  return (
    <div className="h-full flex flex-col">
      {/* top bar */}
      <div className="h-[91px] border-b border-white/10 flex items-center px-4 md:px-6 min-w-0">
        {/* LEFT */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="h-10 w-10 rounded-full hover:bg-white/5 grid place-items-center text-white/80 shrink-0"
            title="Back"
          >
            <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
          </button>

          <div className="text-white text-[18px] font-medium truncate">
            Create Escrow order
          </div>
        </div>

        {/* RIGHT */}
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 grid place-items-center text-white/80 shrink-0"
          title="Close"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <div className="text-white text-3xl">Preview</div>

        {/* CARD */}
        <div className="w-[520px] rounded-[22px] bg-[#0e0e0e] border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Image src="/cpu-svgrepo-com.svg" width={25} height={25} alt="Digital" />
            <div className="px-3 py-1 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-sm">
              {type === 'digital' ? 'Digital product' : 'Physical product'}
            </div>
          </div>

          <div className="flex gap-4">
            <img
              src={draft.imagePreview}
              className="w-[120px] h-[120px] rounded-xl object-cover"
            />

            <div className="flex flex-col justify-center">
              {/* Order Name */}
              <div className="text-[#26D9D9] text-2xl font-medium">
                {draft.orderName}
              </div>

              {/* USD + SOL */}
              <div className="text-white text-3xl font-medium">
                {formatUsdShort(draft.price)}
                <span className="text-white/50 text-lg ml-3">
                  {usdToSol(draft.price)}
                </span>
              </div>

              {/* description */}
              <div className="text-white/50 mt-2">
                {draft.description}
              </div>
            </div>
          </div>

          <div className="mt-6 w-full h-[46px] rounded-[12px] bg-[#7b7b7b] flex items-center justify-center text-black font-medium">
            <Image src="/dollar-sign-svgrepo-black-com.svg" width={22} height={22} alt="Digital" />
            Waiting for buyer to fund...
          </div>
        </div>

        <button className="w-[520px] h-[46px] rounded-[10px] bg-[#26D9D9] text-black font-semibold">
          Create Escrow Order
        </button>
      </div>
    </div>
  );
}

export function EscrowScreen({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (type: 'physical' | 'digital') => void;
}) {
  return (
    <div className="h-full flex flex-col">
      {/* top bar */}
      <div className="h-[91px] border-b border-white/10 flex items-center justify-between px-6">
        <div className="text-white text-[18px] font-medium">Create Escrow order</div>

        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 grid place-items-center text-white/80"
          title="Close"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      {/* body */}
      <div className="mb-5 flex-1 flex items-center justify-center">
        <div className="w-full max-w-[720px] px-6 text-center">
          <div className="text-white text-[27px] font-medium mb-10">
            Is your item Physical or Digital?
          </div>
          <div className="flex items-center justify-center gap-10">
            {/* Physical */}
            <div className="flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={() => onPick('physical')}
                className="w-[138px] h-[138px] rounded-[18px] bg-[#262626] hover:bg-[#303030] transition grid place-items-center"
              >
                <Image src="/box-1-svgrepo-com.svg" width={65} height={65} alt="Physical" />
              </button>

              <div className="text-[#A6A6A6] text-[18px]">Physical</div>
            </div>

            {/* Digital */}
            <div className="flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={() => onPick('digital')}
                className="w-[138px] h-[138px] rounded-[18px] bg-[#262626] hover:bg-[#303030] transition grid place-items-center"
              >
                <Image src="/cpu-svgrepo-com.svg" width={50} height={50} alt="Digital" />
              </button>

              <div className="text-[#A6A6A6] text-[18px]">Digital</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}